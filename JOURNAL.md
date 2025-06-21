https://objectgraph.com/blog/ollama-cors/

Check if CORS is enabled in Ollama
```
curl -X OPTIONS http://localhost:11434 -H "Origin: http://example.com" -H "Access-Control-Request-Method: GET" -I
```

If you see this then it is not enabled:
```
HTTP/1.1 403 Forbidden
Date: Wed, 09 Oct 2024 10:12:15 GMT
Content-Length: 0
```

```
sudo systemctl edit ollama.service

[Service]
Environment="OLLAMA_HOST=0.0.0.0"
Environment="OLLAMA_ORIGINS=*"

sudo service ollama restart
```