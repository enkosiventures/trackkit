// import Document, { Html, Head, Main, NextScript, DocumentProps, DocumentContext } from 'next/document';
// // We simply capture the queue state; no special helper function needed if we inject manually
// import { getSSRQueue } from 'trackkit/ssr'; 

// type Props = DocumentProps & {
//   // Pass the serialized queue as a prop
//   initialQueueState?: any[];
// };

// class MyDocument extends Document<Props> {
//   static async getInitialProps(ctx: DocumentContext) {
//     const initialProps = await Document.getInitialProps(ctx);
    
//     // Capture events tracked during getServerSideProps
//     // We clone the queue to safely serialize it
//     const initialQueueState = [...(getSSRQueue() || [])];

//     return { ...initialProps, initialQueueState };
//   }

//   render() {
//     const { initialQueueState } = this.props;

//     return (
//       <Html lang="en">
//         <Head />
//         <body>
//           <Main />
          
//           {/* Inject the queue state for the client SDK to hydrate */}
//           {initialQueueState && initialQueueState.length > 0 && (
//             <script
//               id="trackkit-ssr"
//               dangerouslySetInnerHTML={{
//                 __html: `window.__tk_ssr_queue=${JSON.stringify(initialQueueState)}`,
//               }}
//             />
//           )}

//           <NextScript />
//         </body>
//       </Html>
//     );
//   }
// }

// export default MyDocument;


import Document, { Html, Head, Main, NextScript } from 'next/document';
import type { DocumentProps, DocumentContext } from 'next/document';
import { getSSRQueue } from 'trackkit/ssr';

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
            <script
              id="trackkit-ssr"
              dangerouslySetInnerHTML={{
                // MUST be __TRACKKIT_SSR_QUEUE__ to match the SDK hydration logic
                __html: `window.__TRACKKIT_SSR_QUEUE__=${JSON.stringify(initialQueueState)}`,
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