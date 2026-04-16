/**
 * EIP-681 URI parser.
 * Parses: ethereum:0x1234@137/transfer?address=0x5678&uint256=1e18
 */

export interface EIP681Intent {
  targetAddress: string;
  chainId?: number;
  functionName?: string;
  value?: string;
  parameters: Record<string, string>;
}

export function parseEIP681(uri: string): EIP681Intent | null {
  if (!uri.startsWith("ethereum:")) return null;

  try {
    const body = uri.slice("ethereum:".length);

    // Split target@chainId/function?params
    let target = body;
    let params = "";
    const queryIdx = body.indexOf("?");
    if (queryIdx >= 0) {
      target = body.slice(0, queryIdx);
      params = body.slice(queryIdx + 1);
    }

    // Parse chainId
    let chainId: number | undefined;
    const atIdx = target.indexOf("@");
    let addressPart = target;
    let functionPart: string | undefined;

    if (atIdx >= 0) {
      addressPart = target.slice(0, atIdx);
      const rest = target.slice(atIdx + 1);
      const slashIdx = rest.indexOf("/");
      if (slashIdx >= 0) {
        chainId = parseInt(rest.slice(0, slashIdx), 10);
        functionPart = rest.slice(slashIdx + 1);
      } else {
        chainId = parseInt(rest, 10);
      }
    } else {
      const slashIdx = target.indexOf("/");
      if (slashIdx >= 0) {
        addressPart = target.slice(0, slashIdx);
        functionPart = target.slice(slashIdx + 1);
      }
    }

    // Parse query parameters
    const parameters: Record<string, string> = {};
    let value: string | undefined;

    if (params) {
      for (const pair of params.split("&")) {
        const [key, val] = pair.split("=");
        if (key && val) {
          const decoded = decodeURIComponent(val);
          if (key === "value") {
            value = decoded;
          } else {
            parameters[key] = decoded;
          }
        }
      }
    }

    // Validate address
    if (!addressPart.startsWith("0x") || addressPart.length !== 42) {
      return null;
    }

    return {
      targetAddress: addressPart,
      chainId: chainId && !isNaN(chainId) ? chainId : undefined,
      functionName: functionPart,
      value,
      parameters,
    };
  } catch {
    return null;
  }
}
