import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Image as SvgImage, Text as SvgText, TSpan } from "react-native-svg";
import * as FileSystem from "expo-file-system/legacy";
import { toneFillColor } from "./statCardSvgBuilder";
import { registerStatCardExportHost, type StatCardRasterJob } from "./statCardRasterizer";
import { STAT_TEXT } from "./statTemplateLayout";

async function writePngFromDataUrl(dataUrl: string, filename: string) {
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!cacheDir) throw new Error("No writable cache directory for export");
  const base64 = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
  const targetUri = `${cacheDir}${filename}`;
  await FileSystem.writeAsStringAsync(targetUri, base64, { encoding: "base64" });
  return targetUri;
}

/** Hidden SVG rasterizer — converts template + stat text to PNG without view-shot. */
export function StatCardExportHost() {
  const [job, setJob] = useState<StatCardRasterJob | null>(null);
  const svgRef = useRef<Svg>(null);

  useEffect(() => registerStatCardExportHost(setJob), []);

  useEffect(() => {
    if (!job) return;
    const timer = setTimeout(() => {
      const node = svgRef.current as unknown as {
        toDataURL?: (cb: (uri: string) => void, opts?: { width?: number; height?: number }) => void;
      } | null;
      if (!node?.toDataURL) {
        job.reject(new Error("SVG rasterizer is unavailable on this device"));
        setJob(null);
        return;
      }
      node.toDataURL(
        (dataUrl) => {
          void (async () => {
            try {
              const uri = await writePngFromDataUrl(dataUrl, job.filename);
              job.resolve(uri);
            } catch (error) {
              job.reject(error instanceof Error ? error : new Error(String(error)));
            } finally {
              setJob(null);
            }
          })();
        },
        { width: job.width, height: job.height },
      );
    }, 64);
    return () => clearTimeout(timer);
  }, [job]);

  if (!job) return null;

  return (
    <View style={styles.host} pointerEvents="none" collapsable={false}>
      <Svg ref={svgRef} width={job.width} height={job.height} viewBox={`0 0 ${job.width} ${job.height}`}>
        <SvgImage
          href={job.templateUri}
          x={0}
          y={0}
          width={job.width}
          height={job.height}
          preserveAspectRatio="none"
        />
        {job.layers?.map((layer, index) => {
          const cx = layer.rect.x + layer.rect.w / 2;
          const labelY = layer.rect.y + layer.rect.h * 0.34;
          const valueY = layer.rect.y + layer.rect.h * 0.78;
          return (
            <React.Fragment key={`export-stat-${index}`}>
              <SvgText
                x={cx}
                y={labelY}
                fill={STAT_TEXT.label}
                fontSize={layer.labelSize}
                fontWeight="800"
                textAnchor="middle"
                letterSpacing={0.7}
              >
                {layer.label.toUpperCase()}
              </SvgText>
              <SvgText
                x={cx}
                y={valueY}
                fill={toneFillColor(layer.tone)}
                fontSize={layer.valueSize}
                fontWeight="900"
                textAnchor="middle"
              >
                <TSpan>{layer.value}</TSpan>
              </SvgText>
            </React.Fragment>
          );
        })}
        {job.achievementLayers?.map((layer, index) => (
          <React.Fragment key={`export-achievement-${index}`}>
            {layer.shadowFill ? (
              <SvgText
                x={layer.x}
                y={layer.y + (layer.shadowDy ?? 2)}
                fill={layer.shadowFill}
                fontSize={layer.fontSize}
                fontWeight={layer.fontWeight}
                textAnchor="middle"
                letterSpacing={layer.letterSpacing}
                opacity={0.85}
              >
                {layer.lines?.length
                  ? layer.lines.map((line, lineIndex) => (
                      <TSpan
                        key={`ach-shadow-${lineIndex}`}
                        x={layer.x}
                        dy={lineIndex === 0 ? 0 : layer.lineHeight ?? layer.fontSize * 1.14}
                      >
                        {line}
                      </TSpan>
                    ))
                  : layer.text}
              </SvgText>
            ) : null}
            <SvgText
              x={layer.x}
              y={layer.y}
              fill={layer.fill}
              fontSize={layer.fontSize}
              fontWeight={layer.fontWeight}
              textAnchor="middle"
              letterSpacing={layer.letterSpacing}
            >
              {layer.lines?.length
                ? layer.lines.map((line, lineIndex) => (
                    <TSpan key={`ach-line-${lineIndex}`} x={layer.x} dy={lineIndex === 0 ? 0 : layer.lineHeight ?? layer.fontSize * 1.14}>
                      {line}
                    </TSpan>
                  ))
                : layer.text}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0.02,
    overflow: "hidden",
    zIndex: -999,
  },
});
