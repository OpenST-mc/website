import { Seo } from '../../components/Seo';

const TITLE = 'OpenST | Portal';
const DESCRIPTION = 'OpenST：归档、转换并在线预览 Minecraft 优秀储电作品。支持 WebGL 投影预览。';

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'OpenST Portal',
  url: 'https://openstmc.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://openstmc.com/archive?search={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};

export default function Head() {
  return (
    <>
      <link rel="stylesheet" href="/css/output.css" />
      <Seo url="https://openstmc.com/" title={TITLE} description={DESCRIPTION} jsonLd={JSON_LD} />
    </>
  );
}
