import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    eas: {
      projectId: "d9c9d223-6666-4ab0-aa43-9669aa97a003"
    },
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
