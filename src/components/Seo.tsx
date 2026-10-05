interface SeoProps {
  /** 页面规范 URL（canonical / og:url） */
  url: string;
  /** 用于 twitter/itemprop 的标题（og:title 由 vike-react 依 +title 生成） */
  title: string;
  /** 用于 twitter/itemprop 的描述（og:description 由 vike-react 依 +description 生成） */
  description: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
}

const DEFAULT_IMAGE = 'https://openstmc.com/images/favicon-1.png';

// 补充 vike-react 未生成的社交/结构化 head 标签（og:title/og:description 已由其生成）。
export function Seo({ url, title, description, image = DEFAULT_IMAGE, type = 'website', jsonLd }: SeoProps) {
  return (
    <>
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:domain" content="openstmc.com" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      <meta itemProp="name" content={title} />
      <meta itemProp="description" content={description} />
      <meta itemProp="image" content={image} />

      <link rel="canonical" href={url} />

      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
    </>
  );
}
