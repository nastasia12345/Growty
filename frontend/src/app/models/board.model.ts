export interface Board {
  id: number;
  title: string;
  description?: string;
  createdAt: string;
  tasks?: KanbanTask[];
}

export interface KanbanTask {
  id: number;
  title: string;
  description?: string;
  deadline?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'ToDo' | 'InProgress' | 'Done';
  boardId: number;
  completedAt?: string;
}
