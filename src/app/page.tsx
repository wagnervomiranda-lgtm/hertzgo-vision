# Clone
git clone https://github.com/SEU_USUARIO/hertzgo-vision.git
cd hertzgo-vision

# Crie a estrutura se não existir
mkdir -p src/app

# Baixe o page.tsx gerado e mova para src/app/page.tsx
# (o arquivo está disponível para download acima nesta conversa)

# Instale as dependências
npm install recharts lucide-react

# Se não tiver Next.js ainda:
npm install next react react-dom typescript @types/react @types/node

# Commit e push
git add .
git commit -m "feat: HertzGo Vision Dashboard"
git push origin main
