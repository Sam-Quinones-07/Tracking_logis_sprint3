# Tracking Logístico — backend

API Spring Boot + PostgreSQL de Trackline. La configuración, el arranque, las pruebas y el estado de las historias están documentados en el [README principal](../README.md).

Arranque rápido (Windows):

```
mvnw.cmd spring-boot:run
```

Usa PostgreSQL local (`localhost:5432/tracking_logistico`, usuario y clave `postgres`). Si tu clave es otra:

```
$env:DB_PASSWORD = "tu-clave"
```
