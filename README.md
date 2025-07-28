# Usage Instruction

## Development Commands
```bash
npm install        # Install the required packages listed in package.json before running development
npm run dev        # Start server in development (client + server)
npm run build      # Production build
npm run start      # Start production server
```
- Use `npm run build` then `npm run start` for server routes testing

- Use `npm run dev` to view change in frontend

## Available Routes
```bash
/           # Figma Index page, containing hardcoded patients
/patients   # Index page listing patient records from database
/login      # Login page
```

Api Routes
```bash
/api/patients       # GET all patients
/api/patients/:id   # GET patient of {id}
#...
# View in ./server/routes/patientRoutes
```