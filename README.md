# BOIDS


I saw some birds flocking at the beach on 2026-02-20.   This is the result via Codex 5.3.  

I retained the [prompts-as-truth](PROMPTS.md).

## Run Locally (Simple Web Server)

From this folder, run:

```
make run
```

```bash
python3 -m http.server 
```

Then open:

`http://localhost:8000`


## Deploy to an exe.dev

````
make deploy
```


## Run on the exe dev

Note I don't use a docker in this case, I wanted a quick and dirty.

```bash
screen
make deploy
CTRL-A-D
CTRL-D
```
