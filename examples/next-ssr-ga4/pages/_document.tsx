import Document, { Html, Head, Main, NextScript } from 'next/document';
import type { DocumentProps, DocumentContext } from 'next/document';
import { getSSRQueue, serializeSSRQueue } from 'trackkit/ssr';

type Props = DocumentProps & {
  initialQueueState?: any[];
};

class MyDocument extends Document<Props> {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    
    // 1. Capture what happened during getServerSideProps
    const initialQueueState = [...(getSSRQueue() || [])];

    return { ...initialProps, initialQueueState };
  }

  render() {
    const { initialQueueState } = this.props;

    return (
      <Html lang="en">
        <Head />
        <body>
          <Main />
          
          {/* 2. Inject using the CORRECT global variable expected by Trackkit */}
          {initialQueueState && initialQueueState.length > 0 && (
            <div
              id="trackkit-ssr"
              dangerouslySetInnerHTML={{
                // serializeSSRQueue escapes </script> breakouts and other XSS vectors
                __html: serializeSSRQueue(initialQueueState),
              }}
            />
          )}

          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;