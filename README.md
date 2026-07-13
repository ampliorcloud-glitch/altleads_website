# AltLeads Web Application

AltLeads is a modern, high-performance web platform built for outbound execution. It features a premium, responsive dark/light mode UI with an interactive 3D Torus model using `@react-three/fiber`, smooth scrolling animations with `gsap`, and is built on top of Next.js 16 and Tailwind CSS v4.

## Project Structure

This repository holds multiple iterations of the AltLeads frontend.

- `/altleads_website-main`: The production-ready Next.js 16 application. This directory contains the fully functional, updated website with proper dark/light mode configuration, optimized layouts, and the interactive 3D hero scene.
- `/src/components`: This directory contains older legacy React/Vite components from previous iterations of the website (before the migration to Next.js). They are preserved here for reference but are no longer actively used in the production build.
- `altleads-demo.html`: A static, single-file compiled demo of the older Vite application.

## Running the Next.js App

To start the modern Next.js application:
```bash
cd altleads_website-main
npm install
npm run dev
```

Then visit `http://localhost:3000`.

## Tech Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Framer Motion & GSAP for animations
- React Three Fiber & Drei for 3D elements
