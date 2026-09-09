CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'private',
  build_type text NOT NULL DEFAULT 'android-gradle',
  default_branch text NOT NULL DEFAULT 'main',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT ON public.projects TO anon;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_read" ON public.projects FOR SELECT USING (visibility = 'public' OR auth.uid() = owner_id);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  is_dir boolean NOT NULL DEFAULT false,
  is_binary boolean NOT NULL DEFAULT false,
  content text NOT NULL DEFAULT '',
  size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);
CREATE INDEX project_files_project_idx ON public.project_files(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_files TO authenticated;
GRANT SELECT ON public.project_files TO anon;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project_files_read" ON public.project_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.visibility = 'public' OR p.owner_id = auth.uid()))
);
CREATE POLICY "project_files_write" ON public.project_files FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
);

CREATE TABLE public.builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'aimhub',
  trigger text NOT NULL DEFAULT 'manual',
  external_id text,
  artifact_url text,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX builds_project_idx ON public.builds(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builds TO authenticated;
GRANT SELECT ON public.builds TO anon;
GRANT ALL ON public.builds TO service_role;
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "builds_read" ON public.builds FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.visibility = 'public' OR p.owner_id = auth.uid()))
);
CREATE POLICY "builds_write" ON public.builds FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid())
);

CREATE TABLE public.build_logs (
  id bigserial PRIMARY KEY,
  build_id uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX build_logs_build_idx ON public.build_logs(build_id, id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_logs TO authenticated;
GRANT SELECT ON public.build_logs TO anon;
GRANT ALL ON public.build_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.build_logs_id_seq TO authenticated, service_role;
ALTER TABLE public.build_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "build_logs_read" ON public.build_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.builds b JOIN public.projects p ON p.id = b.project_id WHERE b.id = build_id AND (p.visibility = 'public' OR p.owner_id = auth.uid()))
);
CREATE POLICY "build_logs_write" ON public.build_logs FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.builds b JOIN public.projects p ON p.id = b.project_id WHERE b.id = build_id AND p.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.builds b JOIN public.projects p ON p.id = b.project_id WHERE b.id = build_id AND p.owner_id = auth.uid())
);

CREATE TABLE public.ai_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'openai-compatible',
  base_url text NOT NULL DEFAULT 'https://api.openai.com/v1',
  model text NOT NULL DEFAULT 'gpt-4o-mini',
  api_key_ciphertext text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'محادثة جديدة',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conversations_own" ON public.ai_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conv_idx ON public.ai_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages_own" ON public.ai_messages FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

CREATE TABLE public.ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  summary text NOT NULL DEFAULT '',
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_proposals TO authenticated;
GRANT ALL ON public.ai_proposals TO service_role;
ALTER TABLE public.ai_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_proposals_own" ON public.ai_proposals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_files_updated_at BEFORE UPDATE ON public.project_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER builds_updated_at BEFORE UPDATE ON public.builds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, split_part(COALESCE(NEW.email, 'user'), '@', 1), COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'user'), '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();