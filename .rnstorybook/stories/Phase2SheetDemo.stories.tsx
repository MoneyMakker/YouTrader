import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase2SheetDemo } from "./Phase2SheetDemo";

const meta = {
  title: "YouTrader/Phase2/BottomSheet",
  component: Phase2SheetDemo,
} satisfies Meta<typeof Phase2SheetDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FixedCompact: Story = { args: { variant: "fixedCompact" } };
export const DynamicSizing: Story = { args: { variant: "dynamic" } };
export const ScrollAndKeyboard: Story = { args: { variant: "scrollKeyboard" } };
export const ModalSheet: Story = { args: { variant: "modal" } };
export const LightAppearance: Story = { args: { variant: "light" } };
export const LongContent: Story = { args: { variant: "longContent" } };
export const LargeAccessibilityFont: Story = { args: { variant: "largeFont" } };
