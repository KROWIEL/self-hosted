// English message catalog. This is the canonical dictionary: its keys define
// the shape every other locale must implement (see ru.ts).
export const en = {
  // Common
  'common.loading': 'Loading…',
  'common.failed': 'Something went wrong',
  'common.delete': 'Delete',
  'common.create': 'Create',
  'common.creating': 'Creating…',
  'common.save': 'Save',
  'common.set': 'Set',
  'common.dismiss': 'Dismiss',
  'common.signOut': 'Sign out',

  // Language switcher
  'lang.ru': 'RU',
  'lang.en': 'EN',

  // Navigation
  'nav.projects': 'Projects',
  'nav.nodes': 'Nodes',
  'nav.templates': 'Templates',
  'nav.git': 'Git access',

  // Home
  'home.subtitle':
    'Deploy your SaaS projects — Java backends and React/Next.js frontends — from a git repository into Docker, behind a reverse proxy with HTTPS.',
  'home.signIn': 'Sign in',
  'home.openDashboard': 'Open dashboard',

  // Login
  'login.welcome': 'Welcome back',
  'login.subtitle': 'Sign in to your Self-Hosted panel',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.signIn': 'Sign in',
  'login.signingIn': 'Signing in…',
  'login.failed': 'Login failed',

  // Projects (dashboard)
  'projects.title': 'Projects',
  'projects.subtitle': 'Group your services. Each deploys from git into a container.',
  'projects.newPlaceholder': 'New project name',
  'projects.empty': 'No projects yet. Create one above.',
  'projects.noServices': 'No services',
  'projects.confirmDelete': 'Delete this project and all its services?',

  // Nodes
  'nodes.title': 'Nodes',
  'nodes.subtitle': 'Servers running the agent. Register one, then start its agent.',
  'nodes.tokenOnce': 'Daemon token for {name} — shown only once.',
  'nodes.namePlaceholder': 'Name',
  'nodes.fqdnPlaceholder': 'FQDN / host',
  'nodes.portPlaceholder': 'Agent port',
  'nodes.add': 'Add node',
  'nodes.adding': 'Adding…',
  'nodes.empty': 'No nodes registered yet.',
  'nodes.start': 'Start agent',
  'nodes.stop': 'Stop agent',
  'nodes.log': 'Log',
  'nodes.hideLog': 'Hide log',
  'nodes.confirmDelete': 'Delete this node?',
  'nodes.disabledHint':
    'Local agent control disabled. Start it manually, or set LOCAL_AGENT_ENABLED=1.',
  'nodes.disabledTitle':
    'Set LOCAL_AGENT_ENABLED=1 to control the agent from the UI',

  // Templates
  'templates.title': 'Templates',
  'templates.subtitle': 'Stack definitions used to build & run services.',
  'templates.builtIn': 'built-in',
  'templates.desc.javaMaven':
    'Builds a Maven project into a JAR and runs it on Temurin 21.',
  'templates.desc.javaGradle':
    'Builds a Gradle project (via the repo wrapper) into a JAR and runs it on Temurin 25.',
  'templates.desc.nextjs':
    'Builds a Next.js app (standalone output) and runs it on Node 20.',
  'templates.desc.reactVite':
    'Builds a Vite React SPA and serves the static assets with nginx.',

  // Project detail
  'project.back': '← Projects',
  'project.services': 'Services',
  'project.noServices': 'No services yet. Create one below.',
  'project.newService': 'New service',
  'project.registerNodeFirst': 'Register a node first on the Nodes page.',
  'project.serviceName': 'Service name',
  'project.repoPlaceholder': 'https://github.com/you/repo',
  'project.branch': 'Branch',
  'project.port': 'Port',
  'project.createService': 'Create service',
  'project.useRepoDockerfile': "Use the repo's own Dockerfile (if present)",
  'project.useRepoDockerfileHint':
    'Off: build with the selected template. On: use a Dockerfile from the repository (must build from source).',
  'project.gitCred': 'Git access',
  'project.gitCredNone': 'Public (no token)',
  'project.gitCredHint': 'Select a credential to clone a private repository.',

  // Git credentials
  'git.title': 'Git access',
  'git.subtitle':
    'Personal Access Tokens used to clone private repositories. Tokens are encrypted at rest and never returned.',
  'git.name': 'Name',
  'git.namePlaceholder': 'e.g. GitHub (personal)',
  'git.provider': 'Provider',
  'git.username': 'Username (optional)',
  'git.usernamePlaceholder': 'leave empty for token auth',
  'git.pat': 'Personal Access Token',
  'git.patPlaceholder': 'ghp_… / glpat-…',
  'git.add': 'Add credential',
  'git.adding': 'Adding…',
  'git.empty': 'No git credentials yet. Add one above.',
  'git.confirmDelete': 'Delete this credential?',
  'git.verify': 'Verify',
  'git.verifying': 'Verifying…',
  'git.verifyRepoPlaceholder': 'https://github.com/you/private-repo',
  'git.verifyHint': 'Enter a repo URL to test access via git ls-remote.',

  // Service detail
  'service.back': '← Project',
  'service.image': 'image',
  'service.deploy': 'Deploy',
  'service.start': 'Start',
  'service.stop': 'Stop',
  'service.restart': 'Restart',
  'service.delete': 'Delete',
  'service.confirmDelete': 'Delete this service and its container?',
  'service.deployments': 'Deployments',
  'service.noDeployments': 'No deployments yet.',
  'service.showLog': 'Show log',
  'service.hideLog': 'Hide log',
  'service.noBuildLog': '(no build log)',
  'service.buildLogLive': 'Build log (live)',
  'service.buildLogWaiting': 'Waiting for build output…',
  'service.environment': 'Environment',
  'service.noVariables': 'No variables.',
  'service.secret': 'secret',
  'service.keyPlaceholder': 'KEY',
  'service.valuePlaceholder': 'value',
  'service.domain': 'Domain',
  'service.domainPlaceholder': 'app.example.com',
  'service.https': "HTTPS (Let's Encrypt)",
  'service.logs': 'Live logs',
  'service.logsStart': 'Stream',
  'service.logsStop': 'Stop',
  'service.logsClear': 'Clear',
  'service.logsEmpty': 'Not streaming. Press “Stream” to watch live container output.',
  'service.logsConnecting': 'Connecting…',
  'service.logsEnded': '— stream ended —',
  'service.rollback': 'Rollback',
  'service.rollbackConfirm': 'Redeploy this image (rollback)?',
  'service.webhook': 'Auto-deploy webhook',
  'service.webhookHint':
    'Send a POST to this URL (e.g. from a Git push webhook) to trigger a deploy. Keep the token secret.',
  'service.copy': 'Copy',
  'service.copied': 'Copied',
  'service.metrics': 'Metrics',
  'metrics.cpu': 'CPU',
  'metrics.memory': 'Memory',
  'metrics.network': 'Network I/O',
  'metrics.pids': 'PIDs',
  'metrics.health': 'Health',
  'metrics.notRunning': 'Container is not running.',

  // Service / deployment statuses
  'status.RUNNING': 'Running',
  'status.SUCCESS': 'Success',
  'status.ONLINE': 'Online',
  'status.BUILDING': 'Building',
  'status.DEPLOYING': 'Deploying',
  'status.QUEUED': 'Queued',
  'status.CREATED': 'Created',
  'status.STOPPED': 'Stopped',
  'status.OFFLINE': 'Offline',
  'status.ERROR': 'Error',
  'status.FAILED': 'Failed',

  // Service types
  'type.BACKEND': 'Backend',
  'type.FRONTEND': 'Frontend',
};
