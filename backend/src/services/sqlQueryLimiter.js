const MAX_CONCURRENT_SQL_QUERIES = 4;

let activeQueries = 0;
const queuedTasks = [];

function runNextTask() {
  if (activeQueries >= MAX_CONCURRENT_SQL_QUERIES || queuedTasks.length === 0) {
    return;
  }

  const task = queuedTasks.shift();
  task();
}

export function runWithGlobalSqlConcurrency(queryTask) {
  return new Promise((resolve, reject) => {
    const runTask = async () => {
      activeQueries += 1;

      try {
        resolve(await queryTask());
      } catch (error) {
        reject(error);
      } finally {
        activeQueries -= 1;
        runNextTask();
      }
    };

    if (activeQueries < MAX_CONCURRENT_SQL_QUERIES) {
      runTask();
      return;
    }

    queuedTasks.push(runTask);
  });
}

export function getGlobalSqlConcurrencyState() {
  return {
    active: activeQueries,
    pending: queuedTasks.length,
    limit: MAX_CONCURRENT_SQL_QUERIES
  };
}