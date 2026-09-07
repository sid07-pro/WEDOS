# Wedding OS

## Current Phase: Phase 1 — Foundation

### Architecture Overview
This is the root project directory for Wedding OS.

- **Mobile Application**: Located in `./mobile`. This is an Expo React Native application.
- **Backend Application**: Located in `./backend`. This is a NestJS REST API.

### Current Technology Stack
- **Mobile**: Expo SDK 54, React Native, TypeScript, Expo Router
- **Backend**: NestJS, TypeScript, Node.js

### Development Commands

**Mobile**:
```bash
cd mobile
npx expo start
```

**Backend**:
```bash
cd backend
npm run start:dev
```

### Note
Business features (such as database integration, authentication, dashboard screens, CRUD operations, etc.) will be implemented in later phases.
