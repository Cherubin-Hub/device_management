import {
  Box,
  Divider,
  Typography,
  Stack,
  TextField
} from "@mui/material";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";

const textFieldProps = {
  // Shared TextField settings keep approval fields consistent with the rest of the report.
  fullWidth: true,
  variant: "outlined",
  size: "small",
  slotProps: {
    inputLabel: {
      shrink: true,
    },
  },
};

export default function ApprovalSection({ approval, onChange }) {
  const updateField = (field) => (event) => {
    // Send approval field updates back to the parent report state.
    onChange(field, event.target.value);
  };

  return (
    <Stack spacing={2.25}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            alignItems: "center",
            bgcolor: "#fff4de",
            borderRadius: 1.5,
            color: "#98631b",
            display: "flex",
            height: 40,
            justifyContent: "center",
            width: 40,
          }}
        >
          <VerifiedUserRoundedIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Approval
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Device Testing Personnel and Signature.
          </Typography>
        </Box>
      </Stack>

      <Divider />

      <TextField
        label="Repair By"
        placeholder="Repair personnel"
        value={approval.testedBy}
        onChange={updateField("testedBy")}
        {...textFieldProps}
      />

      <TextField
        label="Tested By"
        placeholder="Testing personnel"
        value={approval.checkedBySenior}
        onChange={updateField("checkedBySenior")}
        {...textFieldProps}
      />

      <TextField
        label="Senior Tested By"
        placeholder="Senior testing personnel"
        value={approval.checkedBySupervisor}
        onChange={updateField("checkedBySupervisor")}
        {...textFieldProps}
      />

      <TextField
        label="Additional Comments"
        multiline
        rows={5}
        placeholder=""
        value={approval.additionalComments}
        onChange={updateField("additionalComments")}
        {...textFieldProps}
      />

      {/* <Button
        variant="contained"
        color="success"
        size="large"
        startIcon={<CheckCircleRoundedIcon />}
        sx={{ alignSelf: "stretch", fontWeight: 800 }}
      >
        Approve Report
      </Button> */}
    </Stack>
  );
}
