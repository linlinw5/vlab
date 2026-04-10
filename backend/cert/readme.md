```bash
openssl genrsa -out private.key 2048
openssl req -new -key private.key -out certificate.csr
openssl x509 -req -days 3650 -in certificate.csr -signkey private.key -out certificate.crt
```
