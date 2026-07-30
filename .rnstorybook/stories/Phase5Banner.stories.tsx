import type { Meta, StoryObj } from "@storybook/react-native";
import { Phase5BannerDemo } from "./Phase5DesignSystemDemo";

const meta = {
  title: "YouTrader/Phase5/Banner",
  component: Phase5BannerDemo,
} satisfies Meta<typeof Phase5BannerDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tones: Story = { args: { variant: "tones" } };
export const WithAction: Story = { args: { variant: "action" } };
export const Dismissible: Story = { args: { variant: "dismiss" } };
export const LongText: Story = { args: { variant: "long" } };
export const LargeText: Story = { args: { variant: "largeText" } };
export const DarkMode: Story = { args: { variant: "dark" } };
