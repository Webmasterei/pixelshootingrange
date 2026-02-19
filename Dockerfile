FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright

RUN playwright install chromium

COPY . .

RUN mkdir -p /app/simulator_py/data/users && \
    useradd -r -s /bin/false appuser && \
    chown -R appuser:appuser /app && \
    chmod -R 755 /opt/playwright

USER appuser

ENV FLASK_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:3000", "--access-logfile", "-", "--error-logfile", "-", "--timeout", "120", "server:app"]
