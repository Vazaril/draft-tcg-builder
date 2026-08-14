# Backend Draft TCG 
Das Backend sorgt für die sichere Datenverarbeitung und Bereitstellung für das super schöne TS Frontend.

Es ist unterglieder in unterschiedliche Endpoints, welche im Routen Ordner liegen und in app.py registriert sind.

## Deploy:
an sich kann man einfach app.py ausführen (vorher natürlich requirements.txt installieren)
ansonsten auch per Docker:

```
docker build -t draft-tcg-backend .
docker run -d --name draft-tcg-backend --restart unless-stopped -p 5001:5000 draft-tcg-backend
```

## app.py
- registriert die Endpoints
- beinhaltet /health


## auth Endpoint:
- soll die gesamte Nutzer Authentifizierung mit Login, Registrierung, ... beinhalten


## deck endpoint:
- hier dann crud eines decks.