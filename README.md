# Allergen Finder

Allergen Finder is a greenfield product concept for helping people with seasonal inhalant allergies identify likely allergens behind current or expected symptoms.

The repository currently contains foundation planning artifacts:

- `context/idea-notes.md` — original idea notes
- `context/foundation/shape-notes.md` — shaped discovery notes
- `context/foundation/prd.md` — product requirements document

# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

### Google Maps Platform configuration

Live city search and pollen lookup require a server-side environment variable:

- `GOOGLE_MAPS_API_KEY` - Google Maps Platform key used only by server routes.

Enable these APIs in the Google Cloud project before local or deployed live-provider checks:

- Places API
- Geocoding API
- Pollen API

Keep the key out of client code and do not commit it. Restrict the key to only the APIs above, use server/IP restrictions where the deployment platform makes that practical, and configure Google-side quota or billing alerts before exposing the public guest endpoints.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
