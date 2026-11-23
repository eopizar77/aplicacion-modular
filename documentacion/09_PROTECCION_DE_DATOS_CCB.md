# 09 · Protección de Datos Personales y Uso Responsable de la Base CCB

> [!CAUTION]
> **Aviso importante:** Este documento constituye una guía de **arquitectura de privacidad y controles técnicos de ingeniería** (*Privacy by Design*). No sustituye el concepto jurídico de un abogado especializado en derecho comercial y protección de datos personales en Colombia.

---

## 1. Marco Normativo Aplicable en Colombia

Cuando se trabaja con información de empresas y comerciantes registrados en la **Cámara de Comercio de Bogotá (CCB)** o el **RUES**, entran en juego cuatro normas principales:

| Norma | Objeto Principal | Impacto en tu Proyecto |
|---|---|---|
| **Ley Estatutaria 1581 de 2012** y **Decreto 1377 de 2013** (compilado en Decreto 1074 de 2015) | Régimen General de Protección de Datos Personales (Habeas Data). | Un alto porcentaje de comercios en Bogotá están registrados como **Personas Naturales Comerciantes**. Su nombre, cédula, teléfono celular, correo personal y dirección son **datos personales**, no simples datos corporativos irrestrictos. |
| **Artículo 26 del Código de Comercio** | Naturaleza pública del Registro Mercantil. | Que el registro mercantil sea público para fines de publicidad legal y seguridad jurídica del comercio **no otorga autorización automática** para hacer *spam* masivo o tratamiento con finalidades distintas sin observar la Ley 1581. |
| **Ley 2300 de 2023** (*"Ley Dejen de Fregar"*) | Protege el derecho a la intimidad de los consumidores fijando canales, horarios y periodicidad de contacto comercial/cobranza. | Prohíbe contactos fuera de horario hábil (lunes a viernes 7:00 a. m. – 7:00 p. m., sábados 8:00 a. m. – 3:00 p. m.; domingos y festivos prohibido) y exige respetar el canal autorizado y el derecho a no ser contactado. |
| **Contrato / Licencia de la Base de Datos CCB** | Términos contractuales bajo los cuales se adquirió o descargó la base. | Prohíbe la redistribución, exposición pública o publicación de la base de datos en servidores o repositorios. |

---

## 2. Controles Técnicos Implementados en este Repositorio

Para garantizar **Privacidad de Datos por Diseño**, el proyecto ya cuenta con las siguientes barreras técnicas:

1. **Bloqueo en Control de Versiones ([.gitignore](file:///d:/piza77/proyectos/APLICACION__MODULAR/.gitignore)) y Contenedores ([.dockerignore](file:///d:/piza77/proyectos/APLICACION__MODULAR/.dockerignore)):**
   ```gitignore
   # Datos sensibles: NUNCA versionar bases de datos de empresas
   data/privado/
   *.csv
   *.xlsx
   ```
   Cualquier archivo `.csv`, `.xlsx` o carpeta dentro de `data/privado/` está excluido tanto de Git como del contexto de construcción de Docker. Jamás subas la base de la CCB a GitHub, GitLab ni a la imagen del contenedor Nginx.

2. **Cero Rastreadores y Cero Cookies en los Sitios Generados:**
   - Las páginas generadas por `templates/restaurante` **no cargan Google Analytics, Meta Pixel, ni cookies de terceros**, ni usan Google Fonts externas.
   - Toda plantilla incluye automáticamente la página `/privacidad/` ([privacidad.astro](file:///d:/piza77/proyectos/APLICACION__MODULAR/templates/restaurante/src/pages/privacidad.astro)) con los derechos del titular, plazos legales (10 días hábiles para consultas y 15 días hábiles para reclamos según arts. 14 y 15 de la Ley 1581) y datos del responsable configurados en `site.json -> legal`.

---

## 3. Protocolo Recomendado para el Uso de la Base CCB

### Lo que SÍ debes hacer (Bajo Riesgo y Alta Efectividad)
1. **Analítica y Segmentación Agregada en Local (`data/privado/`):**
   - Filtrar por código **CIIU** (ej. `I5611` expendio de comidas preparadas en restaurantes, `G4752` ferreterías, `S9602` peluquerías) y por localidad/barrio (Chapinero, Usaquén, Teusaquillo, Kennedy, Suba).
   - Cruzar con información pública comercial que el propio negocio exhibe para atraer clientes (su ficha de Google Maps o perfil comercial de Instagram) para identificar cuáles **no tienen sitio web** o tienen un enlace caído.
2. **Priorizar Personas Jurídicas (S.A.S., Ltda., S.A.) y Canales Institucionales:**
   - Al contactar un negocio, prioriza correos corporativos (`contacto@empresa.co`, `gerencia@empresa.co`), visitas presenciales al establecimiento en el barrio o canales comerciales abiertos al público.
3. **Nunca publicar una demo con datos reales de un tercero sin su permiso:**
   - Cuando prepares una vista previa para mostrarle a un prospecto, usa tus propios sitios demo (`demo-restaurante`, `demo-cevicheria`) o una URL temporal no indexable (`noindex: true`) que no exponga datos personales de personas naturales.
4. **Registro de Opt-Out (Lista de Exclusión Inmediata):**
   - Si un comercio indica que no desea recibir información, debe marcarse inmediatamente como `NO_CONTACTAR` en tu base local para que nunca vuelva a ser contactado.

### Lo que NO debes hacer
- **No envíes campañas masivas automatizadas (*blast*) por WhatsApp o correo** a miles de registros extraídos de un `.csv`: además de infringir las políticas de WhatsApp Business (bloqueo del número), constituye un riesgo alto de queja ante la **Superintendencia de Industria y Comercio (SIC)**.
- **No almacenes la base CCB sin cifrar** en portátiles o memorias USB sin BitLocker/LUKS.
