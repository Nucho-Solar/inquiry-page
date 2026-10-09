# Nucho Solar - Local Development Setup

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v22.22 or higher; the test suite needs it) - [Install with nvm](https://github.com/nvm-sh/nvm)
- **npm** (comes with Node.js)
- **Git**

Check your versions:
```bash
node --version  # Should be v22.22 or higher
npm --version
git --version
```

## Installation Steps

### 1. Clone the Repository

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd <REPO_NAME>
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including React, Vite, Tailwind CSS, and UI components.

### 3. Environment Configuration (Optional)

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your custom settings if needed:

```bash
# Use your preferred editor
nano .env.local
# or
code .env.local
```

**Available Environment Variables:**
- `VITE_CONTACT_PHONE` - Number for the tap-to-call link shown if sending fails (default: 254758330507)
- `VITE_ADS_CONVERSION_LABEL` - Google Ads conversion label (unset means no conversion event)
- `VITE_APP_NAME` - Application name (default: Nucho Solar)

### 4. Run Development Server

```bash
npm run dev
```

The application will be available at: **http://localhost:8080**

You should see output like:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:8080/
  ➜  Network: use --host to expose
```

## Available Scripts

- **`npm run dev`** - Start development server with hot-reload
- **`npm run build`** - Build for production (output in `dist/` folder)
- **`npm run preview`** - Preview production build locally
- **`npm run lint`** - Run ESLint to check code quality

## Project Structure

```
nucho-solar/
├── src/
│   ├── components/        # React components
│   │   ├── ui/           # Shadcn UI components (Button, Input, etc.)
│   │   └── InquiryForm.tsx  # Main inquiry form component
│   ├── pages/            # Page components
│   │   ├── Index.tsx     # Home page
│   │   └── NotFound.tsx  # 404 page
│   ├── assets/           # Images, logos, fonts
│   │   ├── hero-solar.jpg
│   │   └── nucho-logo.png
│   ├── lib/              # Utility functions
│   ├── hooks/            # Custom React hooks
│   ├── index.css         # Global styles & design tokens
│   └── main.tsx          # Application entry point
├── public/               # Static assets (served as-is)
├── .env.example          # Environment variables template
├── vite.config.ts        # Vite configuration
├── tailwind.config.ts    # Tailwind CSS configuration
└── package.json          # Dependencies and scripts
```

## Testing the Submit Flow Locally

`npm run dev` serves the form but not `/api/inquiry`, so submitting from the dev server fails and the tap-to-call fallback appears. To exercise the function locally:

1. Run `npx vercel dev`. This needs a Vercel login and a linked project, which is an operator step.
2. Set the server variables (`TELEGRAM_*`, `RESEND_*`, `LEAD_EMAIL_TO`, optionally `LEADS_WEBHOOK_*`) for the local run. Never put real values in files that are committed.
3. Fill in the form and wait at least 3 seconds before submitting; faster submissions are treated as bots.

Run the automated tests with `npm test`. They need Node 22.22 or higher.

## Troubleshooting

### Port Already in Use

If port 8080 is already in use:

```bash
# Option 1: Find and kill the process using port 8080
# On macOS/Linux:
lsof -ti:8080 | xargs kill -9

# On Windows:
netstat -ano | findstr :8080
taskkill /PID <PID> /F

# Option 2: Change the port in vite.config.ts
```

### Dependencies Installation Issues

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Build Errors

```bash
# Verify Node.js version
node --version  # Must be v22.22 or higher

# If using wrong version, switch with nvm
nvm install 22
nvm use 22

# Clean build
rm -rf dist
npm run build
```

### Module Not Found Errors

If you see import errors like "Cannot find module '@/components/...'":

```bash
# The @ alias is configured in vite.config.ts
# Make sure you're using the correct import paths
# Example: import { Button } from "@/components/ui/button"
```

## Making Changes

### Development Workflow

1. Make changes to files in `src/`
2. Save the file (Vite will auto-reload)
3. Check the browser at `http://localhost:8080`
4. Fix any errors shown in the terminal or browser console

### Adding New Components

```bash
# Shadcn UI components are already installed
# To add more, use:
npx shadcn-ui@latest add <component-name>

# Example:
npx shadcn-ui@latest add dropdown-menu
```

### Customizing Styles

- **Global styles**: Edit `src/index.css`
- **Tailwind config**: Edit `tailwind.config.ts`
- **Component styles**: Use Tailwind classes in JSX

## Building for Production

### Create Production Build

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder with:
- Minified JavaScript and CSS
- Optimized images
- Generated source maps
- Cache-busting file names

### Preview Production Build Locally

```bash
npm run preview
```

Access the production build at: **http://localhost:4173**

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variables in Vercel dashboard
7. Click "Deploy"

### Deploy to Netlify

1. Push your code to GitHub
2. Visit [netlify.com](https://netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Connect your GitHub repository
5. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
6. Add environment variables in Netlify dashboard
7. Click "Deploy site"

### Deploy to Static Hosting (AWS S3, DigitalOcean Spaces, etc.)

1. Build the project:
   ```bash
   npm run build
   ```

2. Upload the contents of `dist/` folder to your hosting service

3. Configure routing:
   - All routes should serve `index.html` (SPA routing)
   - Example nginx config provided in `nginx.conf`

## Docker Deployment (Optional)

### Build Docker Image

```bash
docker build -t nucho-solar .
```

### Run Docker Container

```bash
docker run -p 3000:80 nucho-solar
```

Access at: **http://localhost:3000**

### Using Docker Compose

```bash
docker-compose up
```

## Environment Variables in Production

When deploying to production, set these environment variables in your hosting platform:

- **`VITE_CONTACT_PHONE`** - Production number for the tap-to-call fallback
- **`VITE_ADS_CONVERSION_LABEL`** - Google Ads conversion label
- **`VITE_APP_NAME`** - Application name (optional)

The Telegram, Resend and `LEADS_WEBHOOK_*` server variables are set in Vercel project settings and must never be prefixed with `VITE_`. See `.env.example` for the names.

**Important:** Environment variables prefixed with `VITE_` are embedded in the build at compile time, not runtime.

## Getting Help

- **Vite Documentation**: https://vitejs.dev/
- **React Documentation**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Shadcn UI**: https://ui.shadcn.com/

## License

[Add your license information here]
