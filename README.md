This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variables

Configure these values before using owner Google Places import:

- `DATABASE_URL`: Postgres connection string.
- `GOOGLE_PLACES_API_KEY`: Server-side Google Places API (New) key.
- `OWNER_PORTAL_AUTHORIZED_USER_IDS`: Comma-separated Clerk user IDs allowed to manage the owner portal venue.
- `PUBLIC_BLOB_STORE_ID`: Vercel Blob store ID.
- `PUBLIC_BLOB_READ_WRITE_TOKEN`: Vercel Blob read/write token.

Keep `GOOGLE_PLACES_API_KEY` on the server only. Do not expose it to the browser.

## Google Places API (New) Setup

1. In Google Cloud Console, enable **Places API (New)** for your project.
2. Create an API key restricted to Places API (New).
3. Apply application restrictions appropriate to your deployment.
4. Set the key as `GOOGLE_PLACES_API_KEY` in your deployment environment.

The owner import flow uses Google data only to prefill an owner-editable review form. Data is saved only after owner confirmation.
