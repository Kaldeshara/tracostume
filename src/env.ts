import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'PostgreSQL connection string.'
	},
	REGISTERING_PASSWORD: {
		description: 'When set, registration asks for this password before the account form.',
		schema: optional
	},
	PUBLIC_APP_NAME: {
		public: true,
		description: 'Product name shown in the header, page titles and the installed app.',
		schema: (value) => value?.trim() || 'Tracostume'
	},
	UPLOADS_DIR: {
		description: 'Directory for photos when no S3 bucket is configured.',
		schema: (value) => value?.trim() || './data/uploads'
	},
	MODELS_DIR: {
		description: 'Cache directory for the semantic-search model (downloaded on first use).',
		schema: (value) => value?.trim() || './data/models'
	},
	AWS_ACCESS_KEY_ID: { schema: optional },
	AWS_SECRET_ACCESS_KEY: { schema: optional },
	AWS_ENDPOINT_URL: { schema: optional },
	AWS_S3_BUCKET_NAME: { schema: optional },
	AWS_DEFAULT_REGION: { schema: (value) => value?.trim() || 'auto' },
	AWS_S3_URL_STYLE: { schema: optional }
});
