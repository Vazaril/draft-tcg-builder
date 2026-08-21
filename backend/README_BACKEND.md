# Backend Draft TCG 
Das Backend sorgt für die sichere Datenverarbeitung und Bereitstellung für das TS Frontend.

Es ist untergliedert in unterschiedliche Endpoints, welche im Routen Ordner liegen und in app.py registriert sind.

## Deploy:
an sich kann man einfach app.py ausführen (vorher natürlich requirements.txt installieren)
ansonsten auch per Docker:

```
docker build -t draft-tcg-backend .
docker stop draft-tcg-backend
docker rm draft-tcg-backend
docker run -d --name draft-tcg-backend --restart unless-stopped --env-file .env -p 5001:5000 draft-tcg-backend
```

## app.py
- registriert die Endpoints
- beinhaltet /health und /joke


## chat:
- hier wird ein simpler chat abgebildet
- das frontend muss auch die alten msg mitsenden:

```
{
  "history": [
    { "role": "user", "content": "Hallo" },
    { "role": "model", "content": "Hi, wie kann ich helfen?" }
  ],
  "message": "Erzähl mir einen Witz"
}
```

## deck endpoint:
- hier dann die AI Generierung