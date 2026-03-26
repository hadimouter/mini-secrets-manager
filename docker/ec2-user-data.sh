#!/bin/bash
# Script d'initialisation EC2 — exécuté automatiquement au premier démarrage
# Installe Docker et AWS CLI, configure l'utilisateur ec2-user

set -e

# Mise à jour du système
dnf update -y

# Installation de Docker
dnf install -y docker
systemctl enable docker
systemctl start docker

# ec2-user peut lancer Docker sans sudo
usermod -aG docker ec2-user

# Installation de AWS CLI v2
dnf install -y unzip
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf awscliv2.zip aws/
