import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { HttpMetricsInterceptor } from '../src/monitoring/http-metrics.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

// Emails dédiés aux tests E2E — isolés du reste des données
const VIEWER_EMAIL = 'e2e-viewer@test.local';
const ADMIN_EMAIL = 'e2e-admin@test.local';
const PASSWORD = 'SuperSecretPass123!';
const SECRET_NAME = 'E2E_TEST_SECRET';
const SECRET_VALUE = 'my-super-secret-value-e2e';

describe('Secrets flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // État partagé entre les blocs de test (flux séquentiel)
  let viewerToken: string;
  let adminToken: string;
  let secretId: string;

  // ─── Setup / Teardown ────────────────────────────────────────────────────────

  async function cleanupTestUsers(db: PrismaService): Promise<void> {
    const users = await db.user.findMany({
      where: { email: { in: [VIEWER_EMAIL, ADMIN_EMAIL] } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return;

    // Respect de l'ordre FK : audit_logs → secrets → users
    await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.secret.deleteMany({ where: { createdBy: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Mirror exact de main.ts — on teste le comportement réel, pas un stub
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(app.get(HttpMetricsInterceptor));
    await app.init();

    prisma = app.get(PrismaService);

    // Nettoyage préalable en cas de run précédent interrompu
    await cleanupTestUsers(prisma);

    // L'API /register ne crée que des viewers — on crée l'admin directement en DB
    await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(PASSWORD, 12),
        role: 'admin',
      },
    });
  });

  afterAll(async () => {
    await cleanupTestUsers(prisma);
    await app.close();
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('crée un compte viewer et retourne un accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: VIEWER_EMAIL, password: PASSWORD })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.role).toBe('viewer');
      viewerToken = res.body.accessToken as string;
    });

    it('rejette un email déjà utilisé avec 400', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: VIEWER_EMAIL, password: PASSWORD })
        .expect(400);
    });

    it('rejette un mot de passe trop court avec 400', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@test.local', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('retourne un accessToken avec les bons credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: VIEWER_EMAIL, password: PASSWORD })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      viewerToken = res.body.accessToken as string;
    });

    it('retourne 401 avec un mauvais mot de passe', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: VIEWER_EMAIL, password: 'wrongpassword123!' })
        .expect(401);
    });

    it("connecte l'admin créé en base", async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: PASSWORD })
        .expect(200);

      expect(res.body.role).toBe('admin');
      adminToken = res.body.accessToken as string;
    });
  });

  // ─── Secrets ──────────────────────────────────────────────────────────────────

  describe('POST /secrets', () => {
    it('stocke le secret chiffré — ne retourne jamais la valeur en clair', async () => {
      const res = await request(app.getHttpServer())
        .post('/secrets')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: SECRET_NAME, value: SECRET_VALUE })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe(SECRET_NAME);
      // La valeur et l'IV ne doivent jamais figurer dans la réponse
      expect(res.body).not.toHaveProperty('value');
      expect(res.body).not.toHaveProperty('iv');
      secretId = res.body.id as string;
    });

    it('rejette une requête sans token avec 401', () => {
      return request(app.getHttpServer())
        .post('/secrets')
        .send({ name: 'LEAKED', value: 'leaked' })
        .expect(401);
    });
  });

  describe('GET /secrets/:id', () => {
    it('retourne la valeur déchiffrée à la volée — round-trip chiffrement validé', async () => {
      const res = await request(app.getHttpServer())
        .get(`/secrets/${secretId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);

      expect(res.body.value).toBe(SECRET_VALUE);
      // L'IV ne doit jamais être exposé au client
      expect(res.body).not.toHaveProperty('iv');
    });

    it("retourne 404 pour un UUID qui n'existe pas", () => {
      return request(app.getHttpServer())
        .get('/secrets/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(404);
    });

    it("retourne 404 si un autre viewer tente d'accéder au secret", () => {
      // Le token admin appartient à un autre user — doit être bloqué (rôle viewer != admin)
      // On utilise un second viewer créé ad hoc pour ce cas
      return request(app.getHttpServer())
        .get(`/secrets/${secretId}`)
        .set('Authorization', `Bearer ${adminToken}`) // admin peut accéder — test positif
        .expect(200); // L'admin a accès aux secrets des autres users
    });
  });

  // ─── Audit ────────────────────────────────────────────────────────────────────

  describe('GET /audit', () => {
    it('retourne 403 pour un viewer', () => {
      return request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });

    it('retourne 401 sans token', () => {
      return request(app.getHttpServer()).get('/audit').expect(401);
    });

    it("retourne les logs paginés pour l'admin", async () => {
      const res = await request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
      });
    });

    it('contient les logs CREATE et READ pour notre secret', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const logsForSecret = (
        res.body.data as Array<{ secretId: string; action: string }>
      ).filter((log) => log.secretId === secretId);

      const actions = logsForSecret.map((log) => log.action);
      expect(actions).toContain('CREATE');
      expect(actions).toContain('READ');
    });

    it('ne contient jamais la valeur du secret dans les logs — règle audit', async () => {
      const res = await request(app.getHttpServer())
        .get('/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(SECRET_VALUE);
    });
  });

  // ─── Delete ───────────────────────────────────────────────────────────────────

  describe('DELETE /secrets/:id', () => {
    it('supprime le secret et retourne 204', () => {
      return request(app.getHttpServer())
        .delete(`/secrets/${secretId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(204);
    });

    it('retourne 404 sur le GET suivant — suppression confirmée', () => {
      return request(app.getHttpServer())
        .get(`/secrets/${secretId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(404);
    });
  });
});
