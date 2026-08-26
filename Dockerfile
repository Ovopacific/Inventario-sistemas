# Usar la imagen oficial ligera de Node.js 20 sobre Alpine Linux
FROM node:20-alpine

# Definir el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar dependencias de producción respetando package-lock.json
RUN npm ci --only=production

# Copiar el resto de los archivos del proyecto
COPY . .

# Crear directorio para la base de datos SQLite
RUN mkdir -p /app/data

# Volumen persistente para la base de datos
VOLUME ["/app/data"]

# Exponer el puerto por defecto de la aplicación
EXPOSE 3000

# Variable de entorno PORT por defecto
ENV PORT=3000

# Comando para arrancar el servidor
CMD ["npm", "start"]
