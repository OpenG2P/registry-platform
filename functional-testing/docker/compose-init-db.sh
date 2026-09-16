#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Keycloak
    CREATE USER keycloak_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE keycloak OWNER keycloak_user;

    -- IAM service
    CREATE USER iam_service_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE iam_service OWNER iam_service_user;

    -- Master Data
    CREATE USER master_data_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE master_data OWNER master_data_user;
    \c master_data
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- AWE
    \c postgres
    CREATE USER awe_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE awe OWNER awe_user;
    \c awe
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- Registry (reference extension)
    CREATE USER registry_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE registry OWNER registry_user;
    \c registry
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    -- ID Generator
    \c postgres
    CREATE USER registry_idgenerator_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE registry_idgenerator OWNER registry_idgenerator_user;

    -- Partner Management
    \c postgres
    CREATE USER partner_management_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE partner_management OWNER partner_management_user;

    -- Consent Manager
    \c postgres
    CREATE USER consent_manager_user WITH PASSWORD '$POSTGRES_PASSWORD';
    CREATE DATABASE consent_manager OWNER consent_manager_user;
EOSQL
