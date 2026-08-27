# Usar imagen Node.js 20 slim con compatibilidad total de módulos nativos (sqlite3)
FROM node:20-slim

# Definir directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev --no-audit

# Copiar el resto de los archivos del proyecto
COPY . .

# Crear directorio para la base de datos SQLite
RUN mkdir -p /app/data

# Volumen persistente para la base de datos
VOLUME ["/app/data"]

# Exponer puerto 3000
EXPOSE 3000

# Variable de entorno PORT por defecto
ENV PORT=3000

# Comando para arrancar el servidor directamente con node
CMD ["node", "server.js"]
