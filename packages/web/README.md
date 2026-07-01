# Hermes AI OS — Frontend Dashboard

## Overview

React + TypeScript + Tailwind dashboard สำหรับ Hermes AI OS ที่เชื่อมกับ backend แบบ real-time

## Features

- ✅ System Overview Panel — แสดง task/agent stats
- ✅ Kanban Board — แสดง tasks ตาม status
- ✅ Agent Monitoring — แสดง agent status + health
- ✅ Event Stream — live event feed
- ✅ WebSocket — real-time updates

## Project Structure

```
packages/web/src/
├── App.tsx                 # Main app layout
├── main.tsx               # Entry point
├── index.css              # Tailwind styles
├── components/
│   ├── OverviewPanel.tsx  # System stats
│   ├── KanbanBoard.tsx    # Task board
│   ├── AgentPanel.tsx     # Agent monitoring
│   └── EventStream.tsx    # Live events
├── hooks/
│   └── useWebSocket.ts    # WebSocket connection
├── services/
│   └── api.ts             # REST API client
├── store/
│   └── dashboard.ts       # Zustand state
└── types/
    └── index.ts           # TypeScript types
```

## How to Run

```bash
cd packages/web
npm install
npm run dev
```

Dashboard will be available at http://localhost:3000

## Backend Connection

- REST API: http://localhost:3001/api
- WebSocket: ws://localhost:3001/socket.io

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Socket.IO (real-time)
