# Evolução Corporal — Android APK

Aplicativo Android que abre o Evolução Corporal em uma WebView independente do Chrome. Utiliza o site oficial hospedado no GitHub Pages:

https://andresalles274-creator.github.io/Evolucao-Corporal/

Este projeto não duplica dados: autenticação, treinos, dietas, mensagens e fotos usam o Supabase já existente. A interface web é atualizada no servidor sem necessidade de recompilar o APK.

## Build

Requer Android SDK (API 35), JDK 17 e Gradle 8.10.2.

    gradle -p android-app assembleDebug

O APK de teste fica em \`android-app/app/build/outputs/apk/debug/app-debug.apk\`.

O workflow \`.github/workflows/android-apk.yml\` faz o build em GitHub Actions, envia um ZIP do APK nos artefatos e cria uma Release com o arquivo \`Evolucao-Corporal.apk\`.

## Recursos

- Login e cadastro pelo mesmo Supabase
- Perfis de coach e aluno
- Upload de fotos com galeria e câmera via seletor Android
- Arquivos enviados diretamente pelo formulário web, sem permissões excessivas
- Acesso seguro apenas por HTTPS
- Mensagem de erro e botão Tentar novamente quando offline
- Voltar com o botão do Android

## Observações importantes

Este é inicialmente um APK de TESTE (debug signing). Para distribuir publicamente com atualizações instaladas por cima, configurar assinatura de release com keystore privado em GitHub Actions Secrets. Não publicar a chave de assinatura no repositório. A funcionalidade de notificações push do navegador pode não funcionar na WebView; precisa ser implementada de forma nativa quando necessária. Requer conexão com internet para sincronização Supabase. Para publicação na Play Store, gerar AAB e verificar os requisitos de políticas da plataforma.
