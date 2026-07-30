import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase3SymbolsDemo } from "./Phase3SymbolsDemo";

const meta = {
  title: "YouTrader/Phase3/Symbols",
  component: Phase3SymbolsDemo,
} satisfies Meta<typeof Phase3SymbolsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SemanticGallery: Story = { args: { variant: "gallery" } };
export const WeightsAndSizes: Story = { args: { variant: "weightsSizes" } };
export const Disabled: Story = { args: { variant: "disabled" } };
export const DecorativeVsMeaningful: Story = { args: { variant: "decorativeVsMeaningful" } };
export const AndroidFallback: Story = { args: { variant: "androidFallback" } };
export const DarkMode: Story = { args: { variant: "dark" } };
export const LightMode: Story = { args: { variant: "light" } };
