import { Asset } from "expo-asset";
import React, { useEffect, useState } from "react";
import { SvgXml } from "react-native-svg";

interface TTakumiLogoProps {
  width?: number;
  height?: number;
  color?: string;
}

export default function TakumiWalletHeaderLogo({
  width = 120,
  height = 24,
  color = "#20222c",
}: TTakumiLogoProps) {
  const [svgContent, setSvgContent] = useState<string>("");

  useEffect(() => {
    const loadSvg = async () => {
      try {
        const asset = Asset.fromModule(
          require("@/assets/images/header_logo.svg"),
        );
        await asset.downloadAsync();

        const response = await fetch(asset.localUri || asset.uri);
        let svgText = await response.text();

        svgText = svgText.replace(/stroke="#D61C4E"/g, 'stroke="currentColor"');
        svgText = svgText.replace(/fill="#D61C4E"/g, 'fill="currentColor"');

        setSvgContent(svgText);
      } catch (error) {
        console.error("Error loading SVG:", error);
      }
    };

    loadSvg();
  }, []);

  if (!svgContent) {
    return null;
  }

  return (
    <SvgXml xml={svgContent} width={width} height={height} color={color} />
  );
}
