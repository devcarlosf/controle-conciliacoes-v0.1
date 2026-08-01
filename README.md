# Finance Manager — Controle de Conciliações

Aplicação 100% local (roda no navegador, dados em `localStorage`).
Esta versão é a **reorganização arquitetural** do arquivo único original:
a lógica foi preservada integralmente e apenas distribuída em arquivos,
com nova camada visual (verde como destaque) e o novo módulo *Bater Saldo*.

## Estrutura

```
/
├── index.html                  Shell da aplicação + menu lateral
├── css/
│   ├── style.css               Entrada (importa base + tema)
│   ├── base.css                Estilos originais preservados
│   └── theme.css               Identidade verde, animações, sidebar, Bater Saldo
├── js/
│   ├── database.js             Estado + persistência (localStorage, chave única)
│   ├── utils.js                Datas, ordenação, escape, grupos, toasts
│   └── app.js                  Render principal, navegação, bootstrap (carregar por último)
├── modules/
│   ├── dashboard/              Painel, aging (tempo sem conciliar), home
│   ├── empresas/               Cadastro, configurações de grupo, acessos
│   ├── categorias/             Categorias e filtros por categoria
│   ├── conciliacao/            Tabela de conciliações e edição de lançamento
│   ├── baterSaldo/             NOVO — estrutura visual (lógica pendente)
│   ├── auditoria/              Histórico, lembretes, calendário
│   ├── importacao/             OFX, Excel e CSV
│   ├── exportacoes/            Utilidades de download/CSV/XLSX
│   ├── backup/                 Exportar / importar / restaurar / limpar
│   └── configuracoes/          Preferências gerais e modelos de mensagem
└── assets/
```

## Como executar

Abra `index.html` no navegador (ou sirva a pasta com qualquer servidor estático).
Os scripts são carregados como scripts clássicos, na ordem definida no `index.html`;
`js/app.js` precisa continuar sendo o último.

## Módulo Bater Saldo

Somente a interface existe. Pontos de extensão preparados em
`modules/baterSaldo/baterSaldo.js`:

- `executarBaterSaldo()` — ponto de entrada da conciliação
- `baterSaldoStrategies` — conciliação inteligente, PIX agrupado, folha de pagamento, regras por empresa
- `baterSaldoState.resultado` — alimenta o painel direito (encontrados, pendentes, diferenças, totais)

## Dados

Nada é apagado ou migrado: a chave `conciliacoes:v3` e o backup `conciliacoes:v3:backup`
continuam com o mesmo formato. Empresas, categorias, importações, histórico e backups
existentes permanecem intactos.
