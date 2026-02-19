#!/bin/bash
set -e

# Risikoarmes Deployment-Script fuer Pixel Shooting Range
# Verwendung: ./deploy.sh [start|stop|restart|status|logs|backup|rollback]

COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR=".backups"
IMAGE_NAME="pixelshootingrange"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

check_env() {
    if [ ! -f .env ]; then
        log "FEHLER: .env Datei fehlt!"
        log "Erstelle mit: cp .env.example .env && openssl rand -hex 32"
        exit 1
    fi
    
    if grep -q "your-secret-here" .env 2>/dev/null; then
        log "FEHLER: SESSION_SECRET in .env noch nicht gesetzt!"
        exit 1
    fi
}

backup_current() {
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    
    if docker images "$IMAGE_NAME" --format "{{.ID}}" | head -1 | grep -q .; then
        CURRENT_ID=$(docker images "$IMAGE_NAME" --format "{{.ID}}" | head -1)
        docker tag "$IMAGE_NAME:latest" "$IMAGE_NAME:backup_$TIMESTAMP"
        log "Backup erstellt: $IMAGE_NAME:backup_$TIMESTAMP (ID: $CURRENT_ID)"
        echo "$TIMESTAMP" > "$BACKUP_DIR/latest"
    fi
}

health_check() {
    log "Warte auf Health-Check..."
    for i in {1..30}; do
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            log "Health-Check erfolgreich!"
            return 0
        fi
        sleep 1
    done
    log "FEHLER: Health-Check fehlgeschlagen nach 30 Sekunden"
    return 1
}

start() {
    check_env
    log "Starte Container..."
    docker compose -f "$COMPOSE_FILE" up -d --build
    
    if health_check; then
        log "Deployment erfolgreich!"
    else
        log "Deployment fehlgeschlagen - fuehre Rollback durch..."
        rollback
        exit 1
    fi
}

stop() {
    log "Stoppe Container..."
    docker compose -f "$COMPOSE_FILE" down
    log "Container gestoppt."
}

restart() {
    check_env
    backup_current
    
    log "Baue neues Image..."
    docker compose -f "$COMPOSE_FILE" build
    
    log "Starte mit neuem Image..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    if health_check; then
        log "Neustart erfolgreich!"
    else
        log "Neustart fehlgeschlagen - fuehre Rollback durch..."
        rollback
        exit 1
    fi
}

status() {
    echo "=== Container Status ==="
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "=== Health ==="
    curl -s http://localhost:3000/health 2>/dev/null || echo "Nicht erreichbar"
    echo ""
    echo "=== Backups ==="
    docker images "$IMAGE_NAME" --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}" | grep backup || echo "Keine Backups"
}

logs() {
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100
}

rollback() {
    if [ ! -f "$BACKUP_DIR/latest" ]; then
        log "FEHLER: Kein Backup vorhanden!"
        exit 1
    fi
    
    LATEST=$(cat "$BACKUP_DIR/latest")
    log "Rollback zu Backup: $LATEST"
    
    docker compose -f "$COMPOSE_FILE" down
    docker tag "$IMAGE_NAME:backup_$LATEST" "$IMAGE_NAME:latest"
    docker compose -f "$COMPOSE_FILE" up -d
    
    if health_check; then
        log "Rollback erfolgreich!"
    else
        log "FEHLER: Auch Rollback fehlgeschlagen!"
        exit 1
    fi
}

cleanup() {
    log "Loesche alte Backups (behalte letzte 3)..."
    docker images "$IMAGE_NAME" --format "{{.Tag}}" | grep "backup_" | sort -r | tail -n +4 | while read tag; do
        docker rmi "$IMAGE_NAME:$tag" 2>/dev/null && log "Geloescht: $tag"
    done
}

case "${1:-start}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    logs)    logs ;;
    backup)  backup_current ;;
    rollback) rollback ;;
    cleanup) cleanup ;;
    *)
        echo "Verwendung: $0 [start|stop|restart|status|logs|backup|rollback|cleanup]"
        exit 1
        ;;
esac
