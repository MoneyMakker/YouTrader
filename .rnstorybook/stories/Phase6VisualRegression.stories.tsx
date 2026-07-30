import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase6VisualRegressionGallery } from "./Phase6VisualRegressionGallery";

const meta = {
  title: "YouTrader/Phase6/VisualRegressionGallery",
  component: Phase6VisualRegressionGallery,
} satisfies Meta<typeof Phase6VisualRegressionGallery>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Canonical dark screenshot target. */
export const DarkGallery: Story = { args: { variant: "dark" } };
/** Canonical light screenshot target. */
export const LightGallery: Story = { args: { variant: "light" } };
/** Large Dynamic Type review (manual / simulator setting). */
export const LargeTextGallery: Story = { args: { variant: "largeText", appearance: "dark" } };
/** Reduce Motion / static skeleton review. */
export const ReduceMotionGallery: Story = { args: { variant: "reduceMotion", appearance: "dark" } };
