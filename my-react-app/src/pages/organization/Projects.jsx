import { OrgPage } from './OrgPage.jsx';
import { getProjects, createProject, updateProject } from '../../api/organization.api.js';

export default function Projects() {
  return (
    <OrgPage
      title="Projects"
      fetchFn={getProjects}
      createFn={createProject}
      updateFn={updateProject}
      columns={[
        { key: 'name', label: 'Name', render: r => <strong>{r.name}</strong> },
        { key: 'code', label: 'Code', dim: true },
        { key: 'client', label: 'Client', dim: true },
        { key: 'status', label: 'Status', render: r => <span className={`badge badge-${r.status === 'active' ? 'online' : 'offline'}`}>{r.status}</span> },
        { key: 'start_date', label: 'Start', dim: true },
      ]}
      formFields={[
        { key: 'name', label: 'Project Name', required: true },
        { key: 'code', label: 'Project Code' },
        { key: 'client', label: 'Client / ULB' },
        { key: 'start_date', label: 'Start Date', type: 'date' },
        { key: 'end_date', label: 'End Date', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'completed'] },
      ]}
      defaultForm={{ name: '', code: '', client: '', start_date: '', end_date: '', status: 'active' }}
    />
  );
}
