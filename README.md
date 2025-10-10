# Greens - AI-Powered Meal Planning App 🥗

A modern meal planning application with AI-powered chat assistance, built with React, TypeScript, Supabase, and OpenAI.

## ✨ Features

- **Weekly Meal Planning**: Drag-and-drop interface for organizing meals
- **AI Sous Chef**: ChatGPT-powered assistant using tool calling to manage your meal plan
- **Meal Inventory**: Store and organize your favorite recipes and meal ideas
- **Grocery List Generation**: AI-powered ingredient extraction from your meal plan
- **Recipe Management**: Store recipes with URLs or custom instructions
- **Multi-device Sync**: All data stored securely in Supabase

## 🛠️ Technologies

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: shadcn/ui with Radix UI primitives
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **AI**: OpenAI GPT-4o with function calling
- **State Management**: TanStack Query (React Query)

## 📋 Prerequisites

- Node.js 18+ and npm/yarn/bun
- [Supabase account](https://supabase.com) (free tier works)
- [OpenAI API key](https://platform.openai.com/api-keys)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (recommended)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <YOUR_GIT_URL>
cd plan-it-drag-n-dine
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
bun install
```

### 3. Set Up Supabase

#### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be provisioned (~2 minutes)

#### Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your Supabase credentials
# Find these at: https://app.supabase.com/project/_/settings/api
```

Update `.env` with your values:
```bash
VITE_SUPABASE_PROJECT_ID="your-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-anon-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

#### Run Database Migrations

Install and link Supabase CLI:
```bash
npm install -g supabase
supabase link --project-ref your-project-id
```

Push database schema:
```bash
supabase db push
```

This creates all necessary tables:
- `profiles` - User profiles
- `meal_plans` - Weekly meal planning data
- `meal_items` - Meal inventory
- `recipes` - Recipe storage
- `grocery_lists` - AI-generated shopping lists
- `chat_messages` - Chat history
- `feedback` - User feedback

### 4. Configure OpenAI

Set your OpenAI API key as a Supabase secret:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here
```

Or via Supabase Dashboard:
- Go to Project Settings → Edge Functions → Secrets
- Add `OPENAI_API_KEY` with your key

### 5. Deploy Edge Functions

Deploy the AI-powered edge functions:

```bash
# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy meal-plan-chat
supabase functions deploy extract-ingredients
```

### 6. Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

## 🎯 Usage

### Basic Workflow

1. **Sign Up/Login**: Create an account using email/password
2. **Add Meals**: Click any cell in the meal grid to add meals
3. **Use AI Assistant**: Click "AI Sous Chef" to chat with the assistant
   - "Add tacos to Tuesday dinner"
   - "Fill out breakfast for the whole week"
   - "What's on my meal plan?"
4. **Manage Inventory**: View and organize your meal items
5. **Generate Grocery List**: Click "Grocery List" to AI-generate ingredients

### AI Chat Examples

The AI assistant uses OpenAI function calling to interact with your meal plan:

```
You: "Add chicken tacos to Monday dinner"
AI: [Calls add_meal_item tool] → "I've added chicken tacos to Monday dinner! 🌮"

You: "Show me what's planned for this week"
AI: [Calls get_meal_plan tool] → [Shows formatted meal plan]

You: "Add oatmeal to my inventory"
AI: [Calls add_to_inventory tool] → "Added oatmeal to your inventory!"
```

## 🔒 Security

See [SECURITY.md](SECURITY.md) for detailed security information.

### Key Points

- ✅ Public keys (in `.env`) are safe to commit
- ✅ Row Level Security (RLS) protects all data
- ❌ Never commit `OPENAI_API_KEY` or service role keys
- ❌ Keep production secrets in Supabase dashboard only

## 📦 Project Structure

```
plan-it-drag-n-dine/
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── ChatInterface.tsx
│   │   └── MealPlanBuilder.tsx
│   ├── hooks/               # Custom React hooks
│   │   └── useMealPlanChat.ts
│   ├── integrations/supabase/
│   │   ├── client.ts        # Supabase client
│   │   └── types.ts         # Database types
│   └── pages/               # Route pages
├── supabase/
│   ├── functions/           # Edge functions
│   │   ├── meal-plan-chat/  # AI chat with tool calling
│   │   └── extract-ingredients/
│   └── migrations/          # Database migrations
├── .env.example             # Environment template
└── SECURITY.md             # Security documentation
```

## 🔧 Development

### Available Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
```

### Database Management

```bash
# View local database
supabase db studio

# Create new migration
supabase db diff -f migration_name

# Reset database (⚠️ deletes all data)
supabase db reset
```

### Edge Function Development

```bash
# Serve functions locally
supabase functions serve

# View logs
supabase functions logs meal-plan-chat --tail
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Note**: Never commit secrets. Check [SECURITY.md](SECURITY.md) before contributing.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [Lovable](https://lovable.dev), [Claude Code](https://claude.ai), and a patchwork of UI/UX tools
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)
- Backend by [Supabase](https://supabase.com)
- AI by [OpenAI](https://openai.com)

## 📞 Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check [SECURITY.md](SECURITY.md) for security concerns

---

**Happy meal planning! 🍽️**
