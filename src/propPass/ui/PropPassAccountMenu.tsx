import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { YdlButton } from "../../ydl/components/YdlButton";
import { YdlText } from "../../ydl/components/YdlText";
import { useYdlTheme } from "../../ydl/tokens";
import { newPropOsClientRequestId } from "../../propOs/commands/hash";
import { runPropPassCommand } from "../commandGateway";
import { humanAccountTitle } from "../presentation";
import type { PropPassViewModel } from "../types";

type Props = {
  model: PropPassViewModel;
  userId: string | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onMessage: (msg: string | null) => void;
  onArchived: () => void;
};

/**
 * Secondary account actions — Archive is destructive and confirmation-gated.
 */
export function PropPassAccountMenu({
  model,
  userId,
  open,
  onClose,
  onRefresh,
  onMessage,
  onArchived,
}: Props) {
  const { t } = useTranslation();
  const theme = useYdlTheme("dark");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = humanAccountTitle(model);

  if (!open) return null;

  return (
    <View
      style={[styles.wrap, { backgroundColor: theme.colors.surface.card }]}
      testID="prop-pass-account-menu-sheet"
      accessibilityViewIsModal
    >
      <YdlText role="label">{t("propPass.account.menuTitle")}</YdlText>
      <YdlText role="caption" color="text.secondary">
        {title}
      </YdlText>

      <YdlButton
        label={t("propPass.account.setDefault")}
        variant="secondary"
        disabled={busy}
        onPress={() => {
          if (!userId || busy) return;
          setBusy(true);
          const req = newPropOsClientRequestId();
          void runPropPassCommand(
            req,
            userId,
            (svc) =>
              svc.setDefaultAccount({
                clientRequestId: req,
                accountId: model.account.id,
              }),
            "prop_pass_default_account_changed",
          ).then((res) => {
            onMessage(
              res.kind === "success"
                ? t("propPass.account.defaultSaved")
                : t("propPass.command.unexpected"),
            );
            setBusy(false);
            onRefresh();
            onClose();
          });
        }}
      />
      <YdlButton
        label={t("propPass.refreshCta")}
        variant="secondary"
        disabled={busy}
        onPress={() => {
          onRefresh();
          onClose();
        }}
      />

      {!archiveConfirm ? (
          <YdlButton
          label={t("propPass.archive.cta")}
          variant="destructive"
          disabled={busy}
          onPress={() => setArchiveConfirm(true)}
          testID="prop-pass-archive-open"
        />
      ) : (
        <View style={styles.confirm} testID="prop-pass-archive-confirm">
          <YdlText role="body" color="text.secondary">
            {t("propPass.archive.confirmBodyNamed", { account: title })}
          </YdlText>
          <YdlButton
            label={t("propPass.archive.confirmCta")}
            variant="destructive"
            disabled={busy}
            testID="prop-pass-archive-confirm-cta"
            onPress={() => {
              if (!userId || busy) return;
              setBusy(true);
              const req = newPropOsClientRequestId();
              void runPropPassCommand(
                req,
                userId,
                (svc) =>
                  svc.archivePropAccount({
                    clientRequestId: req,
                    accountId: model.account.id,
                    confirmActive: true,
                  }),
                "prop_pass_account_archived",
              ).then((res) => {
                setBusy(false);
                setArchiveConfirm(false);
                if (res.kind === "success") {
                  onArchived();
                  onClose();
                } else {
                  onMessage(t("propPass.command.unexpected"));
                }
              });
            }}
          />
          <YdlButton
            label={t("propPass.archive.cancel")}
            variant="tertiary"
            disabled={busy}
            onPress={() => setArchiveConfirm(false)}
          />
        </View>
      )}

      <YdlButton label={t("propPass.account.closeMenu")} variant="tertiary" onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  confirm: { gap: 8 },
});
