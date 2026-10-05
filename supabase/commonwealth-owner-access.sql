-- Apply to the Lead Generator database before enabling Commonwealth embedding.
-- Replace the owner email below with the verified owner/staff emails used for login.
BEGIN;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='leads' LOOP EXECUTE format('DROP POLICY %I ON public.leads',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.leads FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sales FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='sales' LOOP EXECUTE format('DROP POLICY %I ON public.sales',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.sales FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='transactions' LOOP EXECUTE format('DROP POLICY %I ON public.transactions',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.transactions FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='app_settings' LOOP EXECUTE format('DROP POLICY %I ON public.app_settings',p.policyname); END LOOP; END $$;
CREATE POLICY commonwealth_staff ON public.app_settings FOR ALL TO authenticated USING (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com')) WITH CHECK (lower(auth.jwt()->>'email') IN ('angelique@majesticpermits.com'));
COMMIT;
