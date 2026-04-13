bun run build
rm ~/github/guy-hugo/content/tubetable/*
cp dist/* ~/github/guy-hugo/content/tubetable/
mkdir -p ~/github/guy-hugo/netlify/functions/_shared
cp netlify.toml ~/github/guy-hugo/netlify.toml
cp netlify/functions/youtube.ts ~/github/guy-hugo/netlify/functions/youtube.ts
cp netlify/functions/_shared/youtubeApi.ts ~/github/guy-hugo/netlify/functions/_shared/youtubeApi.ts
cd ~/github/guy-hugo
git add -A
git commit
