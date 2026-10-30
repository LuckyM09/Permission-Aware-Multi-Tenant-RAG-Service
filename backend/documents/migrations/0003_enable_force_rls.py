from django.db import migrations


def apply_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        -- 1. Enable & FORCE Row-Level Security on documents_document
        ALTER TABLE documents_document ENABLE ROW LEVEL SECURITY;
        ALTER TABLE documents_document FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation_policy ON documents_document;
        CREATE POLICY tenant_isolation_policy ON documents_document
        FOR ALL
        USING (
            tenant_id::text = current_setting('app.tenant_id', true)
        )
        WITH CHECK (
            tenant_id::text = current_setting('app.tenant_id', true)
        );

        -- 2. Enable & FORCE Row-Level Security on documents_chunk
        ALTER TABLE documents_chunk ENABLE ROW LEVEL SECURITY;
        ALTER TABLE documents_chunk FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation_policy ON documents_chunk;
        CREATE POLICY tenant_isolation_policy ON documents_chunk
        FOR ALL
        USING (
            tenant_id::text = current_setting('app.tenant_id', true)
        )
        WITH CHECK (
            tenant_id::text = current_setting('app.tenant_id', true)
        );

        -- 3. Ensure vaultrag_user non-superuser role exists and has permissions
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaultrag_user') THEN
                CREATE ROLE vaultrag_user WITH LOGIN PASSWORD 'vaultrag_secure_password_dev' CREATEDB;
            END IF;
            GRANT vaultrag_user TO CURRENT_USER;
            GRANT ALL ON ALL TABLES IN SCHEMA public TO vaultrag_user;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO vaultrag_user;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vaultrag_user;
            ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vaultrag_user;
        END $$;
    """)


def reverse_rls(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    schema_editor.execute("""
        DROP POLICY IF EXISTS tenant_isolation_policy ON documents_chunk;
        ALTER TABLE documents_chunk NO FORCE ROW LEVEL SECURITY;
        ALTER TABLE documents_chunk DISABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation_policy ON documents_document;
        ALTER TABLE documents_document NO FORCE ROW LEVEL SECURITY;
        ALTER TABLE documents_document DISABLE ROW LEVEL SECURITY;
    """)


class Migration(migrations.Migration):

    dependencies = [
        ("documents", "0002_alter_chunk_embedding"),
    ]

    operations = [
        migrations.RunPython(apply_rls, reverse_code=reverse_rls),
    ]
