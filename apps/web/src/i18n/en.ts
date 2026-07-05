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
  'common.saving': 'Saving…',
  'common.set': 'Set',
  'common.dismiss': 'Dismiss',
  'common.guideHide': 'Hide guide',
  'common.guideShow': 'Show guide',
  'common.collapse': 'Collapse',
  'common.expand': 'Expand',
  'common.signOut': 'Sign out',
  'common.edit': 'Edit',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.saved': 'Saved',
  'common.close': 'Close',
  'common.done': 'Done',

  // Cleanup / prune
  'cleanup.button': 'Clean up',
  'cleanup.title': 'Reclaim disk space',
  'cleanup.subtitle':
    'Remove Docker junk that builds up over time — stopped containers, dangling images, build cache and unused networks.',
  'cleanup.always':
    'Always removed: stopped containers, unused networks, dangling images and the build cache.',
  'cleanup.allImages': 'Also remove all unused images',
  'cleanup.allImagesHint':
    'Deletes every image not used by a running container. They will be re-pulled/rebuilt on the next deploy.',
  'cleanup.volumes': 'Also remove unused volumes',
  'cleanup.volumesHint':
    'Destructive: deletes volumes not attached to any container. May erase data of stopped databases.',
  'cleanup.confirm':
    'Run cleanup on this node? This removes stopped containers, dangling images and build cache.',
  'cleanup.confirmVolumes':
    'Run cleanup including unused volumes? This can permanently delete data from volumes not attached to a running container.',
  'cleanup.confirmTitle': 'Confirm cleanup',
  'cleanup.running': 'Cleaning…',
  'cleanup.done': 'Cleanup finished.',
  'cleanup.freedSystem': 'System prune',
  'cleanup.freedBuilder': 'Build cache',
  'cleanup.freedVolumes': 'Volumes',

  // Language switcher
  'lang.ru': 'RU',
  'lang.en': 'EN',

  // Shared field labels
  'field.node': 'Node',
  'field.template': 'Template',

  // Navigation
  'nav.projects': 'Projects',
  'nav.nodes': 'Nodes',
  'nav.tunnels': 'Exposure',
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
  'projects.aboutTitle': 'What is a project?',
  'projects.aboutBody':
    'A project groups related services (e.g. a backend and a frontend) and the managed databases they share. It’s your unit of organization — you create services inside a project and they can talk to the same database.',
  'projects.step1Title': 'Create a project',
  'projects.step1Body':
    'Name it after your app or environment (e.g. “Shop” or “Staging”). Add as many as you need.',
  'projects.step2Title': 'Add services & databases',
  'projects.step2Body':
    'Open a project to add services (built from git) and optional managed databases they connect to.',
  'projects.step3Title': 'Deploy & monitor',
  'projects.step3Body':
    'Deploy each service, set env vars and a domain, and watch status right here on the overview.',
  'projects.newPlaceholder': 'New project name',
  'projects.nameLabel': 'Project name',
  'projects.create': 'Create project',
  'projects.empty': 'No projects yet. Create one above.',
  'projects.noServices': 'No services',
  'projects.confirmDelete': 'Delete this project and all its services?',

  // Nodes
  'nodes.title': 'Nodes',
  'nodes.subtitle':
    'Servers where your apps actually build and run. Register a server, start its agent, then deploy services to it.',
  'nodes.aboutTitle': 'What is a node and how does it work?',
  'nodes.aboutBody':
    'A node is any server (VPS or bare metal) with Docker and the lightweight agent installed. The panel never touches Docker directly — it sends commands to each node’s agent, which builds images, runs containers and reports status back. Every service you deploy lives on a node.',
  'nodes.step1Title': 'Register the node',
  'nodes.step1Body':
    'Add the server below with a name, its host/IP and the agent port. You’ll get a one-time daemon token — the panel uses it to authenticate to the agent.',
  'nodes.step2Title': 'Install & run the agent',
  'nodes.step2Body':
    'On the server, run the agent with that token (via the shown command or as a systemd service). It listens on the agent port and connects the node to the panel.',
  'nodes.step3Title': 'Start & deploy',
  'nodes.step3Body':
    'Once the agent is up, the node shows “Running” with live metrics. Pick this node when creating a service, then deploy from git.',
  'nodes.manageTitle': 'Managing nodes',
  'nodes.manageBody':
    'Use Start / Stop to control the agent, “Log” to inspect its output, and live metrics show containers, image size and reclaimable space. Delete removes the node from the panel (it does not wipe the server). A node with running services can’t be deleted until they’re removed.',
  'nodes.guideHide': 'Hide guide',
  'nodes.guideShow': 'Show guide',
  'nodes.addTitle': 'Register a node',
  'nodes.connectionSection': 'Connection',
  'nodes.capacitySection': 'Resource budget',
  'nodes.tokenOnce': 'Daemon token for {name} — shown only once.',
  'nodes.namePlaceholder': 'e.g. prod-eu-1',
  'nodes.fqdnPlaceholder': 'e.g. 203.0.113.5 or node.example.com',
  'nodes.portPlaceholder': '8443',
  'nodes.nameLabel': 'Name',
  'nodes.nameHint': 'A label to recognise this server in the panel.',
  'nodes.fqdnLabel': 'Host / address',
  'nodes.fqdnHint': 'Public IP or domain the panel uses to reach the agent.',
  'nodes.portLabel': 'Agent port',
  'nodes.portHint': 'Port the agent listens on (default 8443).',
  'nodes.capacityHint':
    'Capacity is how much of this machine you allow the platform to use for workloads. The recommended mark is only a small baseline for the node agent/runtime overhead, not a limit for all services.',
  'nodes.add': 'Add node',
  'nodes.addLocal': 'Local agent',
  'nodes.addRemote': 'Add remote node',
  'nodes.addRemoteTitle': 'Add a remote node',
  'nodes.addRemoteHint':
    'Register a server, then run one command on it to install and enroll the agent over TLS.',
  'nodes.installTitle': 'Install command',
  'nodes.installBody':
    'Run this on the target server (Docker + root required). The agent generates a TLS identity, enrolls with the panel using a one-time token, and comes online automatically.',
  'nodes.installCommand': 'Install command (Linux)',
  'nodes.joinTokenNote':
    'The join token is one-time and expires in 1 hour. Re-open this dialog to generate a fresh command.',
  'nodes.agentVersion': 'agent {version}',
  'nodes.lastSeen': 'last seen {time}',
  'nodes.notEnrolled': 'awaiting enrollment',
  'nodes.adding': 'Adding…',
  'nodes.empty': 'No nodes registered yet.',
  'nodes.start': 'Start agent',
  'nodes.stop': 'Stop agent',
  'nodes.startConfirm': 'Start this node agent?',
  'nodes.stopConfirm':
    'Stop this node agent? Running services may become unmanaged from the panel.',
  'nodes.log': 'Log',
  'nodes.hideLog': 'Hide log',
  'nodes.confirmDelete': 'Delete this node?',
  'nodes.disabledHint':
    'Local agent control disabled. Start it manually, or set LOCAL_AGENT_ENABLED=1.',
  'nodes.disabledTitle':
    'Set LOCAL_AGENT_ENABLED=1 to control the agent from the UI',
  'nodes.agentUnreachable': 'Agent is marked as running, but is unreachable',
  'nodes.containers': 'Containers',
  'nodes.images': 'Images',
  'nodes.reclaimable': 'Reclaimable',
  'nodes.volumes': 'Volumes',
  'nodes.servicesOnNode': 'Services',
  'nodes.databasesOnNode': 'Databases',
  'nodes.noServices': 'No services on this node.',
  'nodes.noDatabases': 'No databases on this node.',

  // Resources
  'resources.serviceTitle': 'Resources',
  'resources.serviceHint':
    'Allocated limits are configured on the service; current usage is live data from the node agent.',
  'resources.allocatedCpu': 'Allocated CPU',
  'resources.allocatedRam': 'Allocated RAM',
  'resources.currentCpu': 'Current CPU',
  'resources.currentRam': 'Current RAM',
  'resources.currentUsage': 'Current usage',
  'resources.allocated': 'Allocated',
  'resources.cpuUnit': 'CPU cores',
  'resources.ramUnit': 'Memory limit in MB',
  'resources.limitConfigured': 'configured limit',
  'resources.liveFromAgent': 'live from agent',
  'resources.partialLive': 'partial live data',
  'resources.agentStatsUnavailable': 'Agent stats unavailable',
  'resources.services': 'Services',
  'resources.runningTotal': 'running / total',
  'resources.runningServices': 'Running services',
  'resources.cpuRam': 'CPU / RAM',
  'resources.cpu': 'CPU',
  'resources.memory': 'Memory',
  'resources.cpuLimit': 'CPU limit',
  'resources.memLimit': 'Memory limit (MB)',
  'resources.cpuCapacity': 'CPU capacity',
  'resources.memCapacity': 'Memory capacity (MB)',
  'resources.available': 'available',
  'resources.inUse': 'in use',
  'resources.recommended': 'recommended',
  'resources.nodeOverheadRecommended': 'node overhead baseline',
  'resources.platformCapacity': 'Platform capacity',
  'resources.detectedHardware': 'detected hardware',
  'resources.projectResources': 'Project resources',
  'resources.configureProject': 'Configure project limits',
  'resources.configureCapacity': 'Configure capacity',
  'resources.editServiceLimits': 'Edit service limits',
  'resources.projectLimitHint':
    'Project limits reserve part of platform capacity. Services inside the project cannot exceed the remaining project quota.',
  'resources.alreadyAllocated':
    'Already allocated to services: {cpu} CPU / {mem} MB RAM.',

  // Templates
  'templates.title': 'Templates',
  'templates.subtitle': 'Stack definitions used to build & run services.',
  'templates.aboutTitle': 'What are templates?',
  'templates.aboutBody':
    'A template is a ready-made recipe for a stack — which image builds your code, which image runs it, the Dockerfile and the default port. When you create a service you pick a template, and the node’s agent uses it to build and run your app. You can override the port or use the repo’s own Dockerfile per service.',
  'templates.noteTitle': 'Built-in templates',
  'templates.noteBody':
    'The templates below ship with the panel and are read-only. They cover common Java and JS/TS stacks — pick the closest one when creating a service.',
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
  'project.aboutTitle': 'Working inside a project',
  'project.aboutBody':
    'Here you add services and managed databases, then deploy. A service builds an image from git and runs as a container on a node; a database is a shared sidecar container other services in the project connect to.',
  'project.step1Title': 'Add a service',
  'project.step1Body':
    'Pick a node, a template and a git repo. Optionally use the repo’s own Dockerfile.',
  'project.step2Title': 'Add a database (optional)',
  'project.step2Body':
    'Provision Postgres/MySQL once; multiple services can share it via injected connection env vars.',
  'project.step3Title': 'Open a service to deploy',
  'project.step3Body':
    'Set env vars, a domain and volumes, then deploy and manage backups from the service page.',
  'project.services': 'Services',
  'project.noServices': 'No services yet. Create one below.',
  'project.newService': 'New service',
  'project.registerNodeFirst': 'Register a node first on the Nodes page.',
  'project.serviceName': 'Service name',
  'project.repoPlaceholder': 'https://github.com/you/repo',
  'project.branch': 'Branch',
  'project.port': 'Port',
  'project.createService': 'Create service',
  'project.createServiceHint':
    'Create a service from a git repository, choose where it runs, and assign its initial CPU/RAM limits.',
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
  'git.aboutTitle': 'Why git credentials?',
  'git.aboutBody':
    'Public repos clone without auth. Private repos need a token. Add a Personal Access Token (PAT) once and attach it to a service — the node uses it only at build time to clone your code. Tokens are encrypted at rest and never shown again.',
  'git.step1Title': 'Create a PAT',
  'git.step1Body':
    'On GitHub/GitLab, create a token with read access to your repositories (repo / read_repository scope).',
  'git.step2Title': 'Add it here',
  'git.step2Body':
    'Give it a name, pick the provider and paste the token. Add a username if your provider requires it.',
  'git.step3Title': 'Use & verify',
  'git.step3Body':
    'Select this credential when creating a service, and use “Verify” below to test access to a repo URL.',
  'git.securityNote':
    'Security: paste only read-only repository tokens. The token is encrypted at rest and shown only as masked data after saving.',
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
  'git.repoLabel': 'Repository URL',
  'git.verifyHint': 'Enter a repo URL to test access via git ls-remote.',

  // Service detail
  'service.back': '← Project',
  'service.aboutTitle': 'How a service deploys & runs',
  'service.aboutBody':
    'A service builds a Docker image from your git repo and runs it as a container on its node. Everything you configure here — env vars, domain, volumes, resources, zero-downtime — takes effect on the next deploy.',
  'service.step1Title': 'Configure',
  'service.step1Body':
    'Set env vars and secrets, attach a domain, add volumes and adjust CPU/memory in Settings.',
  'service.step2Title': 'Deploy',
  'service.step2Body':
    'Hit Deploy to build from git and start the container. Watch the build and runtime logs live.',
  'service.step3Title': 'Operate',
  'service.step3Body':
    'Roll back to a previous image, open a terminal, stream logs and stats, or enable zero-downtime deploys.',
  'service.image': 'image',
  'service.deploy': 'Deploy',
  'service.deployConfirm':
    'Start a new deploy now? This will build from git and may replace the running container.',
  'service.start': 'Start',
  'service.startConfirm': 'Start this service container?',
  'service.stop': 'Stop',
  'service.stopConfirm': 'Stop this service container? The app may become unavailable.',
  'service.restart': 'Restart',
  'service.restartConfirm': 'Restart this service container now?',
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
  'service.envDelete': 'Delete variable',
  'service.envDeleteConfirm': 'Delete this variable? Applied on the next deploy.',
  'service.envSetConfirm':
    'Set this environment variable? It may affect the next deploy/runtime.',
  'service.envImport': 'Import .env',
  'service.envImportConfirm':
    'Import these environment variables? Existing keys with the same name will be overwritten.',
  'service.envImportHint':
    'Paste a .env file. KEY=VALUE per line; #comments and quotes are handled. Existing keys are overwritten. Secrets are auto-detected by name.',
  'service.envImportBtn': 'Import',
  'service.envImportCount': '{n} variable(s) detected',
  'service.envImportEmpty': 'No valid KEY=VALUE lines found.',
  // Repo auto-setup
  'setup.button': 'Scan & setup',
  'setup.title': 'Scan repo & auto-setup',
  'setup.hint':
    'Clones the repo and detects databases (docker-compose / .env) and env keys. Selected databases are created and wired up; selected keys are added (DB keys filled automatically, others left blank).',
  'setup.scanning': 'Scanning repository…',
  'setup.databases': 'Detected databases',
  'setup.noDatabases': 'No databases detected.',
  'setup.willCreate': '— will be created & linked',
  'setup.schemas': 'schemas',
  'setup.envFrom': 'Environment from {file}',
  'setup.envNone': 'No .env example found.',
  'setup.exists': 'exists',
  'setup.apply': 'Apply',
  'setup.applyConfirm':
    'Apply detected setup changes? This may create databases and overwrite selected environment variables.',
  'setup.applying': 'Applying…',
  'service.keyPlaceholder': 'KEY',
  'service.valuePlaceholder': 'value',
  'service.domain': 'Domain',
  'service.domainConfirm':
    'Save this domain configuration? Traffic routing and certificates may change.',
  'service.domainPlaceholder': 'example.com',
  'service.domainHint':
    'Use the apex domain (example.com). Traefik routes all subdomains too (admin.example.com, tenant.example.com). For HTTPS add DNS: A *.example.com → VDS IP. For one wildcard cert: ACME_WILDCARD_CERTS=1 + Cloudflare DNS API token in .env.',
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
  'service.info': 'Overview',
  'service.node': 'Node',
  'service.template': 'Template',
  'service.port': 'Port',
  'service.repo': 'Repository',
  'service.gitAccess': 'Git access',
  'service.open': 'Open app',
  'service.settings': 'Settings',
  'service.settingsHint': 'Changes take effect on the next deploy.',
  'service.settingsConfirm':
    'Save these service settings? Changes may affect the next deploy and runtime limits.',
  'service.name': 'Name',
  'service.cpu': 'CPU limit',
  'service.mem': 'Memory limit (MB)',
  'service.zeroDowntime': 'Zero-downtime deploy',
  'service.zeroDowntimeHint':
    'Start a new instance and wait for its health check before switching traffic and stopping the old one. Requires a domain.',
  'service.healthcheckPath': 'Health check path',
  'service.healthTimeout': 'Health timeout (s)',
  'service.activeColor': 'Active instance',
  'service.zeroDowntimeVolumeWarn':
    'Unavailable while the service has persistent volumes — two instances would share the same volume.',
  'service.stepBuild': 'Build',
  'service.stepHealth': 'Health',
  'service.stepSwitchover': 'Switchover',
  'service.stepDeploy': 'Deploy',
  'service.stepLive': 'Live',
  'service.deploymentsShowAll': 'Show history ({count})',
  'service.deploymentsHide': 'Hide history',
  'service.terminal': 'Terminal',
  'service.terminalTitle': 'Container shell',
  'service.terminalHint':
    'Interactive shell inside the running container — inspect files, connect to the database, fix things by hand.',
  'service.terminalConnecting': 'Connecting…',
  'service.terminalClosed': 'Session closed',
  'service.terminalNotRunning': 'Start the container to open a shell.',
  'service.close': 'Close',
  // Persistent volumes
  'volume.title': 'Persistent volumes',
  'volume.hint': 'Mounted into the container. Data survives redeploys. Applied on the next deploy.',
  'volume.mountPath': 'Mount path (e.g. /data)',
  'volume.add': 'Add volume',
  'volume.addConfirm':
    'Add this persistent volume? It will be mounted into the service on the next deploy.',
  'volume.none': 'No volumes yet.',
  'volume.removeConfirm': 'Remove this volume? Stored data may be lost.',
  // Managed databases
  'db.title': 'Databases',
  'db.new': 'New database',
  'db.name': 'Name',
  'db.engine': 'Engine',
  'db.version': 'Version',
  'db.dbName': 'Database name',
  'db.username': 'User',
  'db.create': 'Create database',
  'db.createHint':
    'Provision a managed database container on a node. Services can be attached after creation.',
  'db.creating': 'Provisioning…',
  'db.none': 'No databases yet.',
  'db.host': 'Host',
  'db.port': 'Port',
  'db.connection': 'Connection',
  'db.reveal': 'Show credentials',
  'db.hide': 'Hide',
  'db.password': 'Password',
  'db.url': 'Connection URL',
  'db.attach': 'Attach to service',
  'db.attachConfirm':
    'Attach this database to the selected service? Connection environment variables will be written.',
  'db.attachHint': 'Injects DATABASE_URL + DB_* env vars. Applied on the service’s next deploy.',
  'db.attached': 'Attached',
  'db.selectService': 'Select a service…',
  'db.deleteConfirm': 'Delete this database?',
  'db.startConfirm': 'Start this database container?',
  'db.stopConfirm':
    'Stop this database container? Connected services may fail until it is started again.',
  'db.keepVolume': 'Keep data volume',
  'db.keepVolumeTitle': 'Keep database volume?',
  'db.keepVolumeConfirm': 'Keep volume',
  'db.copy': 'Copy',
  'db.copied': 'Copied',
  'db.internalNote': 'Reachable from your services inside the network at this host.',
  // Backups
  'backup.title': 'Backups',
  'backup.now': 'Backup now',
  'backup.running': 'Backing up…',
  'backup.none': 'No backups yet.',
  'backup.download': 'Download',
  'backup.restore': 'Restore',
  'backup.restoring': 'Restoring…',
  'backup.restoreConfirm':
    'Restore this backup? Current data will be overwritten.',
  'backup.restoreDone': 'Restore complete.',
  'backup.delete': 'Delete',
  'backup.deleteConfirm': 'Delete this backup file?',
  'backup.size': 'Size',
  'backup.failed': 'Failed',
  'backup.schedule': 'Schedule',
  'backup.schedules': 'Schedules',
  'backup.cron': 'Cron (e.g. 0 3 * * *)',
  'backup.keepLast': 'Keep last',
  'backup.addSchedule': 'Add schedule',
  'backup.noSchedules': 'No schedules.',
  'backup.scheduleHint':
    'Runs automatically. Older backups beyond “keep last” are pruned.',
  'service.metrics': 'Metrics',
  'metrics.cpu': 'CPU',
  'metrics.memory': 'Memory',
  'metrics.network': 'Network I/O',
  'metrics.pids': 'PIDs',
  'metrics.health': 'Health',
  'metrics.notRunning': 'Container is not running.',

  // Tunnels / exposure
  'tunnel.title': 'Exposure',
  'tunnel.subtitle':
    'Expose this panel through a lightweight public VDS relay. The VDS only forwards traffic to your local proxy — no Docker, no per-app config.',
  'tunnel.aboutTitle': 'What is a reverse tunnel?',
  'tunnel.aboutBody':
    'If your node sits behind a grey/NAT IP, it isn’t reachable from the internet. A reverse tunnel fixes this: a small client on your side connects out to a tunnel server on a cheap public VDS, which relays public ports (like 443) back to your Traefik. Visitors hit the VDS; traffic is forwarded to your node.',
  'tunnel.step1Title': 'Register the tunnel',
  'tunnel.step1Body':
    'Enter the VDS host, the control port and which ports to relay (usually 443). Point the target to your local proxy.',
  'tunnel.step2Title': 'Install the client',
  'tunnel.step2Body':
    'Use “Install” to get a one-line command. Run it on the VDS (server) and start the client on your side.',
  'tunnel.step3Title': 'Start & point DNS',
  'tunnel.step3Body':
    'Start the tunnel, then point your domain’s A record to the VDS IP. Status turns “Online” once connected.',
  'tunnel.add': 'Add tunnel',
  'tunnel.adding': 'Adding…',
  'tunnel.empty': 'No tunnels yet. Add one to expose this panel via a public VDS.',
  'tunnel.namePlaceholder': 'Name (e.g. home → vds)',
  'tunnel.serverHostPlaceholder': 'Public VDS host or IP',
  'tunnel.controlPortPlaceholder': 'Control port',
  'tunnel.relayPortsPlaceholder': 'Relay ports (e.g. 443 or 443,80)',
  'tunnel.targetHostPlaceholder': 'Local target host',
  'tunnel.nameLabel': 'Name',
  'tunnel.serverHostLabel': 'Public VDS host / IP',
  'tunnel.controlPortLabel': 'Control port',
  'tunnel.relayPortsLabel': 'Relay ports',
  'tunnel.targetHostLabel': 'Local target host',
  'tunnel.proxyProtocol': 'PROXY protocol (preserve client IP)',
  'tunnel.start': 'Start',
  'tunnel.stop': 'Stop',
  'tunnel.connected': 'Connected',
  'tunnel.disconnected': 'Disconnected',
  'tunnel.install': 'Setup VDS',
  'tunnel.installTitle': 'Install on the public VDS',
  'tunnel.installHint':
    'Run ONE of these on your public VDS (white IP). It downloads the relay and starts it as a service. The token is embedded — keep it secret.',
  'tunnel.linux': 'Linux (systemd)',
  'tunnel.windows': 'Windows (admin PowerShell)',
  'tunnel.token': 'Token',
  'tunnel.copy': 'Copy',
  'tunnel.copied': 'Copied',
  'tunnel.offlineTitle': 'Panel on a grey IP? (offline via scp)',
  'tunnel.offlineHint':
    'If your panel is on a private/grey IP, the VDS can’t download from it. Run step 1 on the panel host, then copy the files to the VDS and launch the installer.',
  'tunnel.offlineStep1': '1. On the panel host — download relay + script',
  'tunnel.offlineStep2': '2. On the panel host — copy to the VDS (scp)',
  'tunnel.offlineStep3': '3. Install on the VDS (over ssh)',
  'tunnel.relayingTo': 'Relaying to',
  'tunnel.disabledHint':
    'Local tunnel control is disabled. Set LOCAL_AGENT_ENABLED=1 to run the client from the panel.',
  'tunnel.log': 'Log',
  'tunnel.hideLog': 'Hide log',
  'tunnel.startConfirm': 'Start this tunnel?',
  'tunnel.stopConfirm':
    'Stop this tunnel? Public traffic through the relay will stop.',
  'tunnel.confirmDelete': 'Delete this tunnel?',
  'tunnel.dnsHint':
    'DNS: A example.com and A *.example.com → VDS IP (ports 80/443 via tunnel). TLS on local Traefik: HTTP-01 per subdomain (default) or ACME_WILDCARD_CERTS=1 + Cloudflare token for a *.example.com cert.',

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
