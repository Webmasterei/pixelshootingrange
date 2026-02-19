# Pixel Shooting Range

Interaktiver GA4 E-Commerce Event-Tester im Western-Stil. Nutzer konfigurieren ihren eigenen GTM-Container und/oder CMP-Snippet, "schiessen" auf Schilder und loesen damit echte GA4-E-Commerce-Events aus (`view_item`, `add_to_cart`, `purchase`, etc.).

Gedacht als Test- und Debugging-Werkzeug fuer Google Analytics 4 E-Commerce-Tracking-Setups.

## Funktionsweise

1. Nutzer oeffnet die Seite und klickt auf das Zahnrad-Icon
2. GTM-Snippet (und optional CMP-Snippet) einfuegen und "Anwenden" klicken
3. Die Seite laedt neu -- die Snippets werden serverseitig in den HTML-Code injiziert
4. Klick auf ein Schild = Schuss = `dataLayer.push()` mit dem entsprechenden GA4 E-Commerce Event
5. Events koennen im GTM Preview Mode oder GA4 DebugView verifiziert werden

Die Snippets werden in einer Flask-Session gespeichert (Cookie-basiert, kein Server-State).

## Lokale Entwicklung

**Voraussetzungen:** Python 3.12+

```bash
# Virtual Environment erstellen
python -m venv venv
source venv/bin/activate   # Linux/Mac
# venv\Scripts\activate    # Windows

# Dependencies installieren
pip install -r requirements.txt

# Server starten
python server.py
```

Die App laeuft auf `http://localhost:3000`.

### Mit Docker

```bash
# .env erstellen
cp .env.example .env
# SESSION_SECRET in .env anpassen (openssl rand -hex 32)

# Starten
docker compose up --build

# Oder mit dem Deployment-Script
./deploy.sh start
```

## Deployment (Produktion)

Die App wird per GitHub Actions automatisch auf einen Hetzner-Server deployt.

### CI/CD Pipeline

```
Push auf main --> Docker Image bauen --> GHCR Push --> SSH Deploy auf Server
```

Bei jedem Push auf `main`:
1. Docker-Image wird gebaut und auf `ghcr.io/webmasterei/pixelshootingrange:prod` gepusht
2. Per SSH wird das Image auf dem Server gepullt und der Container neu gestartet
3. Caddy (Host-Service) uebernimmt TLS-Terminierung und Reverse-Proxy

### Ersteinrichtung Server

Die GitHub Actions Pipeline provisioniert sich beim ersten Deploy selbst:
- Erstellt `/opt/pixelshootingrange/` mit `docker-compose.yml`
- Generiert ein sicheres `SESSION_SECRET` in `.env`
- Registriert einen systemd-Service fuer Auto-Start nach Reboot
- Deployt die Caddy-Site-Config fuer die Domain

**Erforderliche GitHub Secrets:**

| Secret | Beschreibung |
|---|---|
| `PROD_HOST` | IPv4-Adresse des Servers |
| `DEPLOY_SSH_KEY` | Privater SSH-Key (root-Zugang) |

### Manuelles Deployment

```bash
# Auf dem Server
cd /opt/pixelshootingrange
docker compose pull
docker compose up -d --remove-orphans
```

### Rollback

```bash
# Lokal mit deploy.sh
./deploy.sh rollback
```

## Projektstruktur

```
pixelshootingrange.de/
  server.py                 # Flask-Server (Snippet-Injection, API, Static Files)
  index.html                # Hauptseite (Shooting Range)
  payment-provider.html     # Simulierte Zahlungsanbieter-Seite
  css/style.css             # Styling
  js/
    app.js                  # Hauptlogik
    constants.js            # Event- und Produkt-Definitionen
    datalayer-events.js     # dataLayer.push()-Aufrufe
    config-panel.js         # GTM/CMP-Konfigurationsdialog
    gun-controller.js       # Pistolen-Animation und Schuss-Logik
    sound.js                # Sound-Effekte
    page-reload-handler.js  # SPA-Modus und Seiten-Reload-Handling
  images/                   # Grafik-Assets
  simulator/                # Playwright-basierter Traffic-Simulator (Node.js)
  Dockerfile                # Container-Image (Python 3.12, Gunicorn)
  docker-compose.yml        # Lokale Entwicklung
  docker-compose.prod.yml   # Produktionsreferenz (GHCR-Image)
  deploy.sh                 # Lokales Deployment-Script mit Rollback
  .github/workflows/        # CI/CD Pipeline
```

## API

| Endpunkt | Methode | Beschreibung |
|---|---|---|
| `/` | GET | Hauptseite mit injizierten Snippets |
| `/api/snippets` | GET | Aktuelle Session-Snippets abrufen |
| `/api/snippets` | POST | Snippets in Session speichern (`gtm_snippet`, `cmp_snippet`) |
| `/health` | GET | Health-Check fuer Container-Orchestrierung |
| `/payment-provider.html` | GET | Simulierte Zahlungsanbieter-Seite |

## Sicherheit

### Session und Secrets

- **SESSION_SECRET** wird als Environment-Variable gesetzt, nie im Code oder Git
- Die `.env`-Datei ist in `.gitignore` und wird nie committet
- In Produktion generiert die CI/CD Pipeline automatisch ein kryptografisch sicheres Secret (`openssl rand -hex 32`)
- Session-Cookies: `HttpOnly`, `SameSite=Strict`, `Secure` (in Produktion)

### Netzwerk

- Der Container bindet nur auf `127.0.0.1:3000` -- nicht oeffentlich erreichbar
- TLS-Terminierung uebernimmt der Host-Caddy-Service (Let's Encrypt)
- Hetzner-Firewall erlaubt nur Port 80, 443 und SSH (IP-eingeschraenkt)

### Container

- Der Container laeuft als non-root User (`appuser`)
- Kein Volume-Mount noetig (stateless App)
- Minimales Base-Image (`python:3.12-slim`)

### HTTP-Header (Produktion)

Wenn `FORCE_HTTPS=true` gesetzt ist, aktiviert Flask-Talisman:
- Content-Security-Policy (nur GTM/GA4-Domains erlaubt)
- HTTPS-Redirect
- X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

Hinter Caddy (Standard-Setup) uebernimmt Caddy die TLS-Terminierung, daher ist `FORCE_HTTPS=false` (kein doppeltes HTTPS).

### Was NICHT ins Git gehoert

- `.env` -- enthaelt das SESSION_SECRET
- `.cursor/` -- IDE-spezifische Konfiguration
- SSH-Keys und Server-Credentials (nur als GitHub Secrets)

## Environment-Variablen

| Variable | Default | Beschreibung |
|---|---|---|
| `SESSION_SECRET` | `dev-secret-...` | Flask Session Secret Key (in Produktion zwingend setzen) |
| `PORT` | `3000` | Server-Port |
| `FLASK_ENV` | `development` | `production` aktiviert ProxyFix und Secure-Cookies |
| `FORCE_HTTPS` | nicht gesetzt | `true` aktiviert Flask-Talisman (CSP, HTTPS-Redirect) |

## Traffic-Simulator

Im Verzeichnis `simulator/` liegt ein Playwright-basiertes Tool, das automatisch Nutzer-Sessions simuliert. Damit lassen sich realistische GA4-Daten erzeugen.

```bash
cd simulator
npm install
npx playwright install chromium
node src/index.js
```

Konfiguration in `simulator/config.json` (Funnel-Raten, Traffic-Quellen, Timing).
