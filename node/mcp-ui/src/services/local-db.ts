import Dexie, { type Table } from 'dexie';

export interface LocalMemory {
  id: string;
  wing: string;
  room: string;
  hall: string;
  content: string;
  session_id?: string;
  agent_name?: string;
  chat_id?: string;
  timestamp: string;
}

export interface LocalNode {
  id: string;
  label: string;
  type: string;
}

export interface LocalEdge {
  id: string;
  source: string;
  target: string;
  relation_type: string;
}

class EngramLocalDatabase extends Dexie {
  memories!: Table<LocalMemory, string>;
  nodes!: Table<LocalNode, string>;
  edges!: Table<LocalEdge, string>;

  constructor() {
    super('EngramLocalDatabase');
    this.version(1).stores({
      memories: 'id, wing, room, hall, session_id, agent_name, timestamp',
      nodes: 'id, label, type',
      edges: 'id, source, target, relation_type'
    });
  }
}

export const db = new EngramLocalDatabase();
