/**
 * Fetches every task for a team by walking Laravel's paginated response.
 * Laravel enforces access control on this call itself (team membership /
 * admin), so an unauthorized caller simply gets a 403 propagated up.
 */
export async function fetchAllTeamTasks(client, teamId, { status, priority, assignedTo } = {}) {
  const tasks = [];
  let page = 1;
  let lastPage = 1;

  do {
    const { data } = await client.get(`/teams/${teamId}/tasks`, {
      params: {
        page,
        per_page: 100,
        status,
        priority,
        assigned_to: assignedTo,
      },
    });

    tasks.push(...data.data);
    lastPage = data.last_page;
    page += 1;
  } while (page <= lastPage);

  return tasks;
}

export async function fetchTeamWithMembers(client, teamId) {
  const { data } = await client.get(`/teams/${teamId}`);
  return data;
}

/** Walks Laravel's paginated /teams response to list every team. */
export async function fetchAllTeams(client) {
  const teams = [];
  let page = 1;
  let lastPage = 1;

  do {
    const { data } = await client.get('/teams', { params: { page, per_page: 100 } });
    teams.push(...data.data);
    lastPage = data.last_page;
    page += 1;
  } while (page <= lastPage);

  return teams;
}

/** Fetches every non-archived task across every team, via the internal service client. */
export async function fetchAllTasksAcrossTeams(client) {
  const teams = await fetchAllTeams(client);
  const tasksByTeam = await Promise.all(teams.map((team) => fetchAllTeamTasks(client, team.id)));
  return tasksByTeam.flat();
}
